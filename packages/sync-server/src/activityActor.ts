import {
  MapView,
  OverlayTx,
  Rejection,
  mutationCtx,
  recKey,
  type MutationRegistry,
  type Projector,
  type Rec,
  type RecRef,
  type ServerMessage,
  type Viewer,
  type WireMutation,
} from '@sync/core';
import { StorageConflictError, type ActivityStorage, type LogEntry } from './storage';

/** How far in the future a mutation's `at` may be, to absorb client clock error. */
const MAX_FUTURE_AT_MS = 2 * 60_000;

export interface ActorConn {
  readonly id: string;
  readonly clientId: string;
  readonly viewer: Viewer;
  send(msg: ServerMessage): void;
  /** Ends the connection; the client reconnects and resubscribes. */
  close(code: number, reason: string): void;
}

export interface ActorDeps {
  storage: ActivityStorage;
  registry: MutationRegistry;
  projector: Projector;
  now(): number;
}

interface Subscription {
  conn: ActorConn;
  viewKey: string;
  /** Version this connection's client is at, as far as we've told it. */
  sentVersion: number;
  sentMutationId: number;
}

type Applied = { writes: Map<string, Rec> } | { reason: string; message: string };

/**
 * Owns one activity in memory and applies its mutations one at a time. Only one actor may own
 * an activity at a time (a single process for now; a lease when there are several).
 */
export class ActivityActor {
  private readonly records = new Map<string, Rec>();
  private version = 0;
  private readonly lastMutationIds = new Map<string, number>();
  private readonly subs = new Map<string, Subscription>();
  private queue: Promise<unknown> = Promise.resolve();
  /** Set when storage shows another process wrote this activity; the hub then loads a fresh actor. */
  stale = false;

  private constructor(
    readonly activityId: string,
    private readonly deps: ActorDeps,
  ) {}

  static async load(activityId: string, deps: ActorDeps): Promise<ActivityActor> {
    const actor = new ActivityActor(activityId, deps);
    const stored = await deps.storage.load(activityId);
    if (stored) {
      actor.version = stored.version;
      for (const r of stored.records) actor.records.set(recKey(r), r);
      for (const [clientId, id] of Object.entries(stored.lastMutationIds)) actor.lastMutationIds.set(clientId, id);
    }
    return actor;
  }

  get currentVersion(): number {
    return this.version;
  }

  get subscriberCount(): number {
    return this.subs.size;
  }

  subscribe(conn: ActorConn, since: number): Promise<void> {
    return this.serial(() => this.doSubscribe(conn, since));
  }

  unsubscribe(connId: string): void {
    this.subs.delete(connId);
  }

  push(conn: ActorConn, mutations: WireMutation[]): Promise<void> {
    return this.serial(() => this.doPush(conn, mutations));
  }

  /** Every visible record as a view sees it; for catch-up, tests and the dev dashboard. */
  projectedRecords(viewKey: string): Rec[] {
    const out: Rec[] = [];
    for (const r of this.records.values()) {
      if (r.deleted) continue;
      const p = this.deps.projector.project(viewKey, r);
      if (p) out.push(p);
    }
    return out;
  }

  /**
   * Our in-memory state is behind storage. Disconnect every subscriber: their clients reconnect,
   * resubscribe to a freshly loaded actor and resend anything unconfirmed.
   */
  private retire(): void {
    this.stale = true;
    for (const sub of this.subs.values()) sub.conn.close(1012, 'activity reloaded');
    this.subs.clear();
  }

  private serial<T>(fn: () => Promise<T> | T): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private doSubscribe(conn: ActorConn, since: number): void {
    if (this.stale) return conn.close(1012, 'activity reloaded');
    const viewKey = this.deps.projector.viewKey(conn.viewer);
    const lastMutationId = this.lastMutationIds.get(conn.clientId) ?? 0;
    if (since === 0 || since > this.version) {
      // A client ahead of us means the server lost data; start it over.
      conn.send({ t: 'reset', activityId: this.activityId, to: this.version, records: this.projectedRecords(viewKey), lastMutationId });
    } else {
      const changed = [...this.records.values()].filter((r) => r.version > since);
      const { upserts, deletes } = this.diff(viewKey, changed);
      conn.send({ t: 'update', activityId: this.activityId, from: since, to: this.version, upserts, deletes, lastMutationId });
    }
    this.subs.set(conn.id, { conn, viewKey, sentVersion: this.version, sentMutationId: lastMutationId });
  }

  private async doPush(conn: ActorConn, mutations: WireMutation[]): Promise<void> {
    if (this.stale) return conn.close(1012, 'activity reloaded');
    if (!this.subs.has(conn.id)) {
      conn.send({ t: 'error', code: 'not_subscribed', message: `Subscribe to ${this.activityId} before pushing` });
      return;
    }
    const receivedAt = this.deps.now();
    const batch = new OverlayTx(new MapView(this.records));
    let version = this.version;
    let lastId = this.lastMutationIds.get(conn.clientId) ?? 0;
    const log: LogEntry[] = [];
    const rejects: ServerMessage[] = [];

    for (const m of mutations) {
      if (m.id <= lastId) continue; // already applied or rejected; resent after a reconnect
      lastId = m.id;
      const entry = {
        activityId: this.activityId,
        mutationId: m.id,
        clientId: conn.clientId,
        userId: conn.viewer.userId,
        name: m.name,
        v: m.v,
        args: m.args,
        clientTime: m.clientTime,
        receivedAt,
      };
      const result = this.applyOne(batch, conn, m, receivedAt);
      if ('reason' in result) {
        log.push({ ...entry, version, outcome: 'rejected', reason: result.reason, effects: [] });
        rejects.push({ t: 'reject', activityId: this.activityId, mutationId: m.id, reason: result.reason, message: result.message });
        continue;
      }
      version += 1;
      const effects: LogEntry['effects'] = [];
      for (const [key, r] of result.writes) {
        const stamped = { ...r, version };
        effects.push({ type: r.type, id: r.id, before: batch.get(r.type, r.id), after: r.deleted ? undefined : stamped });
        batch.writes.set(key, stamped);
      }
      const at = (m.args as { at?: unknown } | null)?.at;
      log.push({ ...entry, version, at: typeof at === 'number' ? at : undefined, outcome: 'applied', effects });
    }
    if (log.length === 0) return;

    const changed = [...batch.writes.values()];
    try {
      await this.deps.storage.commit(this.activityId, { fromVersion: this.version, version, records: changed, lastMutationIds: { [conn.clientId]: lastId }, log });
    } catch (err) {
      if (err instanceof StorageConflictError) this.retire();
      throw err;
    }

    for (const r of changed) this.records.set(recKey(r), r);
    this.version = version;
    this.lastMutationIds.set(conn.clientId, lastId);
    for (const r of rejects) conn.send(r);
    this.fanOut(changed);
  }

  private applyOne(batch: OverlayTx, conn: ActorConn, m: WireMutation, receivedAt: number): Applied {
    const reject = (reason: string, message: string): Applied => ({ reason, message });
    const def = this.deps.registry.get(m.name, m.v);
    if (!def) return reject('unknown_mutation', `Unknown change type ${m.name}@${m.v}`);
    if (def.allow && !def.allow(conn.viewer)) return reject('forbidden', 'Your role cannot make this change');
    const parsed = def.args.safeParse(m.args);
    if (!parsed.success) return reject('bad_args', parsed.error.issues[0]?.message ?? 'Invalid change');
    if (def.timed) {
      const at = (parsed.data as { at?: unknown }).at;
      if (typeof at !== 'number') return reject('bad_args', 'Missing time');
      if (at > receivedAt + MAX_FUTURE_AT_MS) return reject('at_in_future', 'That time is in the future');
    }
    const tx = new OverlayTx(batch);
    try {
      def.run(tx, parsed.data, mutationCtx(conn.viewer, conn.clientId, m.id, 'server'));
    } catch (err) {
      if (err instanceof Rejection) return reject(err.code, err.message);
      console.error(`sync: ${m.name} failed on the server`, err);
      return reject('internal', 'The server could not apply this change');
    }
    return { writes: tx.writes };
  }

  /** Projects the changes once per view key, then sends each subscriber what it hasn't seen. */
  private fanOut(changed: Rec[]): void {
    const byView = new Map<string, Subscription[]>();
    for (const sub of this.subs.values()) {
      const group = byView.get(sub.viewKey) ?? [];
      group.push(sub);
      byView.set(sub.viewKey, group);
    }
    for (const [viewKey, subs] of byView) {
      const { upserts, deletes } = this.diff(viewKey, changed);
      for (const sub of subs) {
        const lastMutationId = this.lastMutationIds.get(sub.conn.clientId) ?? 0;
        if (upserts.length === 0 && deletes.length === 0 && lastMutationId === sub.sentMutationId) continue;
        sub.conn.send({ t: 'update', activityId: this.activityId, from: sub.sentVersion, to: this.version, upserts, deletes, lastMutationId });
        sub.sentVersion = this.version;
        sub.sentMutationId = lastMutationId;
      }
    }
  }

  /** Visible records become upserts; deleted or invisible ones become deletes (ids are random, so these reveal little). */
  private diff(viewKey: string, records: Rec[]): { upserts: Rec[]; deletes: RecRef[] } {
    const upserts: Rec[] = [];
    const deletes: RecRef[] = [];
    for (const r of records) {
      const p = r.deleted ? null : this.deps.projector.project(viewKey, r);
      if (p) upserts.push(p);
      else deletes.push({ type: r.type, id: r.id });
    }
    return { upserts, deletes };
  }
}
