import {
  ClientActivityState,
  ClockSync,
  Rejection,
  decode,
  encode,
  randomId,
  type ClientMessage,
  type ActivitySnapshot,
  type MutationRegistry,
  type ReadView,
  type Rec,
  type ServerMessage,
  type Viewer,
  type WireMutation,
} from '@sync/core';
import { MemoryPersistence, type ClientPersistence } from './persistence';
import type { Transport } from './transport';

const PING_INTERVAL_MS = 15_000;
/** Three missed pongs: tolerant of slow links, unlike a single-timeout check. */
const DEAD_AFTER_MS = 45_000;
const FLUSH_DELAY_MS = 50;
const PERSIST_DELAY_MS = 250;
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export type ConnectionState = 'offline' | 'connecting' | 'live';

export interface SyncStatus {
  state: ConnectionState;
  rtt: number | undefined;
  clockOffset: number;
  pending: number;
}

export interface RejectionNotice {
  activityId: string;
  mutation: WireMutation;
  description: string;
  reason: string;
  message: string;
}

/** An activity read once, without subscribing; version 0 when the server doesn't have it. */
export interface ActivityDownload {
  version: number;
  view: string | undefined;
  records: Rec[];
}

export interface SyncClientOptions {
  registry: MutationRegistry;
  /** Used for local permission checks and previews; the server decides for real. */
  viewer: Viewer;
  /**
   * Who they are on an activity when that isn't `viewer`, from the view the server projects its
   * records for (undefined until it says) and the records as they are now; undefined, by far the
   * usual case, for `viewer`. When who they are changes, the server disconnects and starts the
   * activity over in the new view.
   */
  viewerIn?(activityId: string, copy: { view: string | undefined; records: ReadView }): Viewer | undefined;
  /** Makes a transport for each connection attempt. */
  transport: () => Transport;
  persistence?: ClientPersistence;
  build?: string;
  /**
   * Reads an activity once (over HTTP), for activities opened not live. Throws when it can't reach
   * the server. Without it, every activity opens live.
   */
  download?(activityId: string): Promise<ActivityDownload>;
}

export interface OpenOptions {
  /**
   * False: read it once and don't subscribe, for an activity no one is likely to change (a completed
   * one). It isn't kept offline. It goes live with `goLive`, or on the first change made to it here.
   * Default true.
   */
  live?: boolean;
}

interface OpenActivity {
  state: ClientActivityState;
  listeners: Set<() => void>;
  /** Highest mutation id sent on the current connection. */
  pushedUpTo: number;
  /** Subscribed (or to be, once connected), and kept offline. Otherwise read once with `download`. */
  live: boolean;
  /** A not-live activity whose download failed, to try again once connected. */
  downloadFailed?: boolean;
}

export class SyncClient {
  private readonly persistence: ClientPersistence;
  private readonly activities = new Map<string, OpenActivity>();
  private readonly statusListeners = new Set<() => void>();
  private readonly rejectListeners = new Set<(r: RejectionNotice) => void>();
  private readonly messageListeners = new Set<(dir: 'in' | 'out', msg: unknown) => void>();
  private readonly clock = new ClockSync();
  private readonly ready: Promise<void>;
  private clientId = '';
  private nextMutationId = 1;
  private transport: Transport | undefined;
  private connState: ConnectionState = 'offline';
  private stopped = true;
  /** The latest start() or stop() call: a stop() while start() waits for persistence wins. */
  private wanted = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly dirty = new Set<string>();
  private pingN = 0;
  private readonly pingsSent = new Map<number, number>();
  private lastHeard = 0;
  private currentStatus: SyncStatus = { state: 'offline', rtt: undefined, clockOffset: 0, pending: 0 };

  constructor(private readonly opts: SyncClientOptions) {
    this.persistence = opts.persistence ?? new MemoryPersistence();
    this.ready = this.loadMeta();
  }

  /** Who this client acts as. Fixed for the client's life: a different user or tier is a new client. */
  get viewer(): Viewer {
    return this.opts.viewer;
  }

  /** Who this client acts as on an activity, as it is now; `viewer` until it's open. */
  viewerIn(activityId: string): Viewer {
    const state = this.activities.get(activityId)?.state;
    return state ? this.viewerAt(state, state.snapshot) : this.opts.viewer;
  }

  private viewerAt(state: ClientActivityState, records: ReadView): Viewer {
    return this.opts.viewerIn?.(state.activityId, { view: state.view, records }) ?? this.opts.viewer;
  }

  get status(): SyncStatus {
    return this.currentStatus;
  }

  /** Current time on the server's clock. Use this, never Date.now(), for `at` and "minutes ago". */
  now(): number {
    return this.clock.now();
  }

  async start(): Promise<void> {
    this.wanted = true;
    await this.ready;
    if (!this.wanted || !this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.wanted = false;
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.dropConnection();
    this.flushPersist();
  }

  /** Reconnect now instead of waiting out the backoff, e.g. when the browser reports it's online. */
  kick(): void {
    if (this.stopped || this.transport) return;
    clearTimeout(this.reconnectTimer);
    this.connect();
  }

  /** Opens an activity, live unless `options.live` is false. Opening one that's open not live, live, makes it live. */
  async open(activityId: string, options: OpenOptions = {}): Promise<void> {
    const wantLive = options.live ?? true;
    await this.ready;
    if (this.activities.has(activityId)) {
      if (wantLive) this.goLive(activityId);
      return;
    }
    const state: ClientActivityState = new ClientActivityState(activityId, this.opts.registry, (records) => this.viewerAt(state, records), this.clientId);
    const saved = await this.persistence.loadActivity(activityId);
    if (saved) {
      state.restore(saved);
      for (const m of saved.pending) this.nextMutationId = Math.max(this.nextMutationId, m.id + 1);
    }
    if (this.activities.has(activityId)) {
      if (wantLive) this.goLive(activityId);
      return;
    }
    // Changes still to send need the subscription.
    const live = wantLive || !this.opts.download || !!saved?.pending.length;
    this.activities.set(activityId, { state, listeners: new Set(), pushedUpTo: 0, live });
    if (!live) void this.download(activityId);
    else if (this.connState === 'live') {
      this.send({ t: 'sub', activityId, since: state.version, view: state.view });
      this.flush();
    }
    this.updateStatus();
  }

  /** Whether an open activity is live: subscribed, rather than read once. */
  isLive(activityId: string): boolean {
    return this.activity(activityId).live;
  }

  /** Subscribes to an activity opened not live, carrying on from the version it read. */
  goLive(activityId: string): void {
    const e = this.activities.get(activityId);
    if (!e || e.live) return;
    e.live = true;
    e.downloadFailed = false;
    if (this.connState === 'live') {
      this.send({ t: 'sub', activityId, since: e.state.version, view: e.state.view });
      this.flush();
    }
    this.changed(activityId); // kept offline from now on
  }

  close(activityId: string): void {
    const e = this.activities.get(activityId);
    if (!e) return;
    this.activities.delete(activityId);
    if (e.live && this.connState === 'live') this.send({ t: 'unsub', activityId });
    this.updateStatus();
  }

  /**
   * The server has answered and has nothing for it: no change to it has ever applied, so it doesn't
   * exist there (yet: one being created here exists once its createActivity reaches the server).
   * False until the server answers, as when offline.
   */
  missing(activityId: string): boolean {
    const state = this.activity(activityId).state;
    return state.heard && state.version === 0;
  }

  snapshot(activityId: string): ActivitySnapshot {
    return this.activity(activityId).state.snapshot;
  }

  describe(activityId: string, m: WireMutation): string {
    return this.activity(activityId).state.describe(m);
  }

  subscribe(activityId: string, listener: () => void): () => void {
    const listeners = this.activity(activityId).listeners;
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  onStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onReject(listener: (r: RejectionNotice) => void): () => void {
    this.rejectListeners.add(listener);
    return () => this.rejectListeners.delete(listener);
  }

  /** Every message sent and received, for debugging tools. */
  onMessage(listener: (dir: 'in' | 'out', msg: unknown) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  /**
   * Applies a change locally at once and queues it for the server.
   * Throws Rejection, without queueing, if it can't apply locally.
   */
  mutate(activityId: string, name: string, args: Record<string, unknown>): WireMutation {
    const e = this.activity(activityId);
    const def = this.opts.registry.latest(name);
    if (!def) throw new Rejection('unknown_mutation', `Unknown change type ${name}`);
    if (def.allow && !def.allow(this.viewerIn(activityId))) throw new Rejection('forbidden', 'Your role cannot make this change');
    const now = this.now();
    const parsed = def.args.safeParse(def.timed && args.at == null ? { ...args, at: now } : args);
    if (!parsed.success) throw new Rejection('bad_args', parsed.error.issues[0]?.message ?? 'Invalid change');
    const m: WireMutation = { id: this.nextMutationId, name, v: def.version, args: parsed.data, clientTime: now };
    e.state.addLocal(m);
    this.nextMutationId += 1;
    if (!e.live) this.goLive(activityId);
    // Saved right away: reusing an id after a crash would make the server drop the change as a duplicate.
    void this.persistence.saveMeta({ clientId: this.clientId, nextMutationId: this.nextMutationId });
    this.changed(activityId);
    this.scheduleFlush();
    return m;
  }

  private activity(activityId: string): OpenActivity {
    const e = this.activities.get(activityId);
    if (!e) throw new Error(`Activity ${activityId} is not open`);
    return e;
  }

  /** Reads a not-live activity once. If it can't, it tries again the next time it connects. */
  private async download(activityId: string): Promise<void> {
    const e = this.activities.get(activityId);
    if (!e || e.live || !this.opts.download) return;
    e.downloadFailed = false;
    let read: ActivityDownload;
    try {
      read = await this.opts.download(activityId);
    } catch (err) {
      console.warn(`sync: could not read ${activityId}`, err);
      if (this.activities.get(activityId) === e && !e.live) e.downloadFailed = true;
      return;
    }
    // Closed, or gone live, while it was reading.
    if (this.activities.get(activityId) !== e || e.live) return;
    e.state.applyReset({ t: 'reset', activityId, view: read.view, to: read.version, records: read.records, lastMutationId: 0 });
    this.changed(activityId);
  }

  private async loadMeta(): Promise<void> {
    const meta = await this.persistence.loadMeta();
    this.clientId = meta?.clientId ?? randomId();
    this.nextMutationId = meta?.nextMutationId ?? 1;
    if (!meta) await this.persistence.saveMeta({ clientId: this.clientId, nextMutationId: this.nextMutationId });
  }

  private connect(): void {
    if (this.stopped) return;
    this.setConnState('connecting');
    const t = this.opts.transport();
    this.transport = t;
    t.open({
      onOpen: () => {
        if (this.transport !== t) return;
        this.attempt = 0;
        this.lastHeard = Date.now();
        const subs = [...this.activities]
          .filter(([, e]) => e.live)
          .map(([activityId, e]) => {
            e.pushedUpTo = 0; // resend everything pending; the server skips what it already has
            return { activityId, since: e.state.version, view: e.state.view };
          });
        this.send({ t: 'hello', clientId: this.clientId, build: this.opts.build ?? 'dev', subs });
        this.setConnState('live');
        this.flush();
        this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL_MS);
        this.ping();
        for (const [activityId, e] of this.activities) if (e.downloadFailed) void this.download(activityId);
      },
      onMessage: (text) => {
        if (this.transport !== t) return;
        this.lastHeard = Date.now();
        this.receive(decode(text) as ServerMessage);
      },
      onClose: () => {
        if (this.transport !== t) return;
        this.dropConnection();
        this.scheduleReconnect();
      },
    });
  }

  private dropConnection(): void {
    clearInterval(this.pingTimer);
    const t = this.transport;
    this.transport = undefined;
    t?.close();
    this.pingsSent.clear();
    this.setConnState('offline');
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const base = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** this.attempt);
    this.attempt += 1;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), base * (0.5 + Math.random() / 2));
  }

  private ping(): void {
    if (Date.now() - this.lastHeard > DEAD_AFTER_MS) {
      this.dropConnection();
      this.scheduleReconnect();
      return;
    }
    this.pingN += 1;
    this.pingsSent.set(this.pingN, Date.now());
    this.send({ t: 'ping', n: this.pingN });
  }

  private receive(msg: ServerMessage): void {
    for (const l of this.messageListeners) l('in', msg);
    switch (msg.t) {
      case 'pong': {
        const sentAt = this.pingsSent.get(msg.n);
        if (sentAt !== undefined) {
          this.pingsSent.delete(msg.n);
          this.clock.sample(sentAt, Date.now(), msg.serverTime);
          this.updateStatus();
        }
        break;
      }
      case 'reset': {
        const e = this.activities.get(msg.activityId);
        if (!e) break;
        e.state.applyReset(msg);
        this.seenMutationId(msg.lastMutationId);
        this.changed(msg.activityId);
        break;
      }
      case 'update': {
        const e = this.activities.get(msg.activityId);
        if (!e) break;
        if (!e.state.applyUpdate(msg)) {
          this.send({ t: 'sub', activityId: msg.activityId, since: e.state.version, view: e.state.view });
          break;
        }
        this.seenMutationId(msg.lastMutationId);
        this.changed(msg.activityId);
        break;
      }
      case 'reject': {
        const e = this.activities.get(msg.activityId);
        const dropped = e?.state.applyReject(msg.mutationId);
        if (!dropped) break;
        this.changed(msg.activityId);
        for (const l of this.rejectListeners) l({ activityId: msg.activityId, ...dropped, reason: msg.reason, message: msg.message });
        break;
      }
      case 'reload':
        console.warn(`sync: server asked for a reload (${msg.reason})`);
        break;
      case 'error':
        console.warn(`sync: server error ${msg.code}: ${msg.message}`);
        break;
    }
  }

  /** Never reuse an id the server has seen, even if local state was lost. */
  private seenMutationId(id: number): void {
    if (id < this.nextMutationId) return;
    this.nextMutationId = id + 1;
    void this.persistence.saveMeta({ clientId: this.clientId, nextMutationId: this.nextMutationId });
  }

  private send(msg: ClientMessage): void {
    if (!this.transport) return;
    for (const l of this.messageListeners) l('out', msg);
    this.transport.send(encode(msg));
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flush();
    }, FLUSH_DELAY_MS);
  }

  /** Sends pending mutations not yet sent on this connection, batched per activity. */
  private flush(): void {
    if (this.connState !== 'live') return;
    for (const [activityId, e] of this.activities) {
      if (!e.live) continue;
      const unsent = e.state.pending.filter((m) => m.id > e.pushedUpTo);
      const last = unsent.at(-1);
      if (!last) continue;
      this.send({ t: 'push', activityId, mutations: unsent });
      e.pushedUpTo = last.id;
    }
  }

  private changed(activityId: string): void {
    const e = this.activities.get(activityId);
    if (e) for (const l of e.listeners) l();
    if (e && !e.live) return this.updateStatus(); // not kept offline
    this.dirty.add(activityId);
    if (!this.persistTimer) this.persistTimer = setTimeout(() => this.flushPersist(), PERSIST_DELAY_MS);
    this.updateStatus();
  }

  private flushPersist(): void {
    clearTimeout(this.persistTimer);
    this.persistTimer = undefined;
    for (const activityId of this.dirty) {
      const e = this.activities.get(activityId);
      if (e) void this.persistence.saveActivity(activityId, e.state.persisted());
    }
    this.dirty.clear();
  }

  private setConnState(state: ConnectionState): void {
    this.connState = state;
    this.updateStatus();
  }

  private updateStatus(): void {
    let pending = 0;
    for (const e of this.activities.values()) pending += e.state.pending.length;
    const next: SyncStatus = { state: this.connState, rtt: this.clock.rtt, clockOffset: Math.round(this.clock.offset), pending };
    const cur = this.currentStatus;
    if (cur.state === next.state && cur.rtt === next.rtt && cur.clockOffset === next.clockOffset && cur.pending === next.pending) return;
    this.currentStatus = next;
    for (const l of this.statusListeners) l();
  }
}
