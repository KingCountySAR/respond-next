import { ClientMessage, decode, encode, randomId, type ServerMessage, type Viewer } from '@sync/core';
import { EventActor, type ActorConn, type ActorDeps } from './eventActor';
import { StorageConflictError } from './storage';

/** The transport side of one client connection (a WebSocket in production, a fake in tests). */
export interface HubConnection {
  readonly viewer: Viewer;
  send(text: string): void;
  close(code: number, reason: string): void;
}

export interface HubDeps extends ActorDeps {
  /** Called for every message in and out, e.g. for the server log. */
  log?(dir: 'in' | 'out', connId: string, msg: unknown): void;
}

interface Conn {
  id: string;
  transport: HubConnection;
  actorConn?: ActorConn;
  events: Set<string>;
  queue: Promise<unknown>;
  closed: boolean;
}

/** Routes client connections to event actors. Each connection's messages are handled in order. */
export class Hub {
  private readonly actors = new Map<string, Promise<EventActor>>();

  constructor(private readonly deps: HubDeps) {}

  connect(transport: HubConnection): { message(text: string): void; close(): void } {
    const conn: Conn = { id: randomId(), transport, events: new Set(), queue: Promise.resolve(), closed: false };
    return {
      message: (text) => this.receive(conn, text),
      close: () => this.disconnect(conn),
    };
  }

  async actor(eventId: string): Promise<EventActor> {
    const cached = this.actors.get(eventId);
    if (cached) {
      const actor = await cached;
      if (!actor.stale) return actor;
      // Only replace it if no one else has already.
      if (this.actors.get(eventId) === cached) this.actors.delete(eventId);
      return this.actor(eventId);
    }
    const loading = EventActor.load(eventId, this.deps);
    this.actors.set(eventId, loading);
    loading.catch(() => {
      if (this.actors.get(eventId) === loading) this.actors.delete(eventId);
    });
    return loading;
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
      for (const s of msg.subs) await this.subscribe(conn, conn.actorConn, s.eventId, s.since);
      return;
    }
    const actorConn = conn.actorConn;
    if (!actorConn) {
      this.send(conn, { t: 'error', code: 'no_hello', message: 'Send hello first' });
      return;
    }
    switch (msg.t) {
      case 'sub':
        await this.subscribe(conn, actorConn, msg.eventId, msg.since);
        break;
      case 'unsub':
        conn.events.delete(msg.eventId);
        (await this.actor(msg.eventId)).unsubscribe(conn.id);
        break;
      case 'push':
        await (await this.actor(msg.eventId)).push(actorConn, msg.mutations);
        break;
    }
  }

  private async subscribe(conn: Conn, actorConn: ActorConn, eventId: string, since: number): Promise<void> {
    // Phase 1: any connection may open any event. Grants are checked here in phase 2.
    conn.events.add(eventId);
    await (await this.actor(eventId)).subscribe(actorConn, since);
  }

  private send(conn: Conn, msg: ServerMessage): void {
    if (conn.closed) return;
    this.deps.log?.('out', conn.id, msg);
    conn.transport.send(encode(msg));
  }

  private disconnect(conn: Conn): void {
    if (conn.closed) return;
    conn.closed = true;
    for (const eventId of conn.events) void this.actors.get(eventId)?.then((a) => a.unsubscribe(conn.id));
  }
}
