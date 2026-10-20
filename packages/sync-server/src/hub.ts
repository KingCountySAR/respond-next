import { ACCESS_CHANGED, ClientMessage, decode, encode, randomId, type ServerMessage, type Viewer } from '@sync/core';
import { ActivityActor, ActorUnloadedError, type ActivityRead, type ActorConn, type ActorDeps } from './activityActor';
import { StorageConflictError } from './storage';

/** The transport side of one client connection (a WebSocket in production, a fake in tests). */
export interface HubConnection {
  readonly viewer: Viewer;
  /** Who they are on one activity when that isn't `viewer` (a grant there); undefined, by far the usual case, for `viewer`. */
  viewerIn?(activityId: string): Viewer | undefined;
  send(text: string): void;
  close(code: number, reason: string): void;
}

export interface HubDeps extends ActorDeps {
  /** Called for every message in and out, e.g. for the server log. */
  log?(dir: 'in' | 'out', connId: string, msg: unknown): void;
  /** Scopes only the server writes (e.g. the activity list): clients may read them but not push. */
  readOnly?(activityId: string): boolean;
  /** How long an activity no one is subscribed to stays in memory; see `unloadIdle`. Default 5 minutes. */
  idleMs?: number;
}

const DEFAULT_IDLE_MS = 5 * 60_000;

interface Conn {
  id: string;
  transport: HubConnection;
  actorConn?: ActorConn;
  /** The connection as each activity it opened sees it: itself, unless they're someone else there. */
  activities: Map<string, ActorConn>;
  queue: Promise<unknown>;
  closed: boolean;
}

/** Routes client connections to activity actors. Each connection's messages are handled in order. */
export class Hub {
  private readonly actors = new Map<string, Promise<ActivityActor>>();
  private readonly conns = new Set<Conn>();

  constructor(private readonly deps: HubDeps) {}

  connect(transport: HubConnection): { message(text: string): void; close(): void } {
    const conn: Conn = { id: randomId(), transport, activities: new Map(), queue: Promise.resolve(), closed: false };
    this.conns.add(conn);
    return {
      message: (text) => this.receive(conn, text),
      close: () => this.disconnect(conn),
    };
  }

  async actor(activityId: string): Promise<ActivityActor> {
    const cached = this.actors.get(activityId);
    if (cached) {
      const actor = await cached;
      if (!actor.stale && !actor.unloaded) return actor;
      // Only replace it if no one else has already.
      if (this.actors.get(activityId) === cached) this.actors.delete(activityId);
      return this.actor(activityId);
    }
    const loading = ActivityActor.load(activityId, this.deps);
    this.actors.set(activityId, loading);
    loading.catch(() => {
      if (this.actors.get(activityId) === loading) this.actors.delete(activityId);
    });
    return loading;
  }

  /**
   * Disconnects everyone `match` picks, e.g. someone whose grants changed. Their clients reconnect,
   * as who they are now.
   */
  disconnectWhere(match: (viewer: Viewer) => boolean): void {
    for (const conn of this.conns) {
      if (!match(conn.transport.viewer)) continue;
      conn.transport.close(ACCESS_CHANGED, 'access changed');
      this.disconnect(conn);
    }
  }

  /** Applies changes the server makes itself; see ActivityActor.pushAsSystem. */
  pushAsSystem(activityId: string, viewer: Viewer, changes: { name: string; v?: number; args: unknown }[]): Promise<void> {
    return this.withActor(activityId, (a) => a.pushAsSystem(viewer, changes));
  }

  /** The activity as `viewer` sees it, once, without subscribing (e.g. a completed one, over HTTP). Version 0: it doesn't exist. */
  read(activityId: string, viewer: Viewer): Promise<ActivityRead> {
    return this.withActor(activityId, (a) => a.read(viewer));
  }

  /**
   * Unloads activities no one has been subscribed to, and that have done nothing, for `idleMs`; the
   * next thing to need one loads it again. Returns how many it unloaded. Call it now and then.
   */
  async unloadIdle(): Promise<number> {
    const idleSince = this.deps.now() - (this.deps.idleMs ?? DEFAULT_IDLE_MS);
    let unloaded = 0;
    for (const [activityId, loading] of [...this.actors]) {
      const actor = await loading.catch(() => undefined);
      if (!actor || !(await actor.unloadIfIdle(idleSince))) continue;
      if (this.actors.get(activityId) === loading) this.actors.delete(activityId);
      unloaded++;
    }
    return unloaded;
  }

  /** How many activities are in memory, for the dev dashboard and tests. */
  get loadedCount(): number {
    return this.actors.size;
  }

  /** Runs `fn` on the activity's actor, again on a fresh one if that was unloaded meanwhile. */
  private async withActor<T>(activityId: string, fn: (actor: ActivityActor) => Promise<T>): Promise<T> {
    for (;;) {
      try {
        return await fn(await this.actor(activityId));
      } catch (err) {
        if (!(err instanceof ActorUnloadedError)) throw err;
      }
    }
  }

  private receive(conn: Conn, text: string): void {
    if (conn.closed) return;
    let msg: ClientMessage;
    try {
      msg = ClientMessage.parse(decode(text));
    } catch {
      this.send(conn, { t: 'error', code: 'bad_message', message: 'Unreadable message' });
      return;
    }
    this.deps.log?.('in', conn.id, msg);
    // Answered at once, outside the queue, so round-trip times aren't inflated by other work.
    if (msg.t === 'ping') {
      this.send(conn, { t: 'pong', n: msg.n, serverTime: this.deps.now() });
      return;
    }
    conn.queue = conn.queue
      .then(() => this.handle(conn, msg))
      .catch((err) => {
        if (err instanceof StorageConflictError) console.warn(`sync: ${err.message}; reloading it`);
        else console.error('sync: closing connection after an error', err);
        if (conn.closed) return; // the actor already closed it
        conn.transport.close(1011, 'internal error');
        this.disconnect(conn);
      });
  }

  private async handle(conn: Conn, msg: ClientMessage): Promise<void> {
    if (conn.closed) return;
    if (msg.t === 'hello') {
      conn.actorConn = {
        id: conn.id,
        clientId: msg.clientId,
        viewer: conn.transport.viewer,
        send: (m) => this.send(conn, m),
        close: (code, reason) => {
          conn.transport.close(code, reason);
          this.disconnect(conn);
        },
      };
      for (const s of msg.subs) await this.subscribe(conn, conn.actorConn, s.activityId, s.since, s.view);
      return;
    }
    const actorConn = conn.actorConn;
    if (!actorConn) {
      this.send(conn, { t: 'error', code: 'no_hello', message: 'Send hello first' });
      return;
    }
    switch (msg.t) {
      case 'sub':
        await this.subscribe(conn, actorConn, msg.activityId, msg.since, msg.view);
        break;
      case 'unsub':
        conn.activities.delete(msg.activityId);
        (await this.actors.get(msg.activityId)?.catch(() => undefined))?.unsubscribe(conn.id);
        break;
      case 'push':
        if (this.deps.readOnly?.(msg.activityId)) {
          for (const m of msg.mutations) this.send(conn, { t: 'reject', activityId: msg.activityId, mutationId: m.id, reason: 'read_only', message: 'Only the server changes this' });
          break;
        }
        await this.withActor(msg.activityId, (a) => a.push(conn.activities.get(msg.activityId) ?? actorConn, msg.mutations));
        break;
    }
  }

  private async subscribe(conn: Conn, actorConn: ActorConn, activityId: string, since: number, view?: string): Promise<void> {
    // Any connection may open any activity, for now. One that doesn't exist gets an empty reset at
    // version 0, which tells the client so (or, for one being created, that its createActivity is
    // still to come); nothing is stored until a change applies.
    const viewer = conn.transport.viewerIn?.(activityId);
    const there: ActorConn = viewer ? { ...actorConn, viewer } : actorConn;
    conn.activities.set(activityId, there);
    await this.withActor(activityId, (a) => a.subscribe(there, since, view));
  }

  private send(conn: Conn, msg: ServerMessage): void {
    if (conn.closed) return;
    this.deps.log?.('out', conn.id, msg);
    conn.transport.send(encode(msg));
  }

  private disconnect(conn: Conn): void {
    if (conn.closed) return;
    conn.closed = true;
    this.conns.delete(conn);
    for (const activityId of conn.activities.keys()) void this.actors.get(activityId)?.then((a) => a.unsubscribe(conn.id));
  }
}
