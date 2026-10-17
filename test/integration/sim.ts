import type { Transport, TransportHandlers } from '@sync/client';
import type { Viewer } from '@sync/core';
import type { Hub } from '@sync/server';

/** Seeded PRNG so failing runs can be replayed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * An in-process network between SyncClients and a Hub, driven by (fake) timers.
 * Like TCP, each direction delivers in order; latency varies and links can be cut.
 */
export class SimNetwork {
  latencyMs = 100;
  readonly down = new Set<number>();
  private readonly active = new Map<number, SimTransport>();

  constructor(
    readonly hub: Hub,
    readonly rand: () => number,
  ) {}

  /** One-way delay with jitter. */
  delay(): number {
    return (this.latencyMs / 2) * (0.5 + this.rand());
  }

  transportFor(index: number, viewer: Viewer): () => Transport {
    return () => new SimTransport(this, index, viewer);
  }

  cut(index: number): void {
    this.down.add(index);
    this.active.get(index)?.kill();
  }

  restore(index: number): void {
    this.down.delete(index);
  }

  register(index: number, t: SimTransport | undefined): void {
    if (t) this.active.set(index, t);
    else this.active.delete(index);
  }
}

class SimTransport implements Transport {
  private handlers: TransportHandlers | undefined;
  private server: ReturnType<Hub['connect']> | undefined;
  private closed = false;
  private toServerAt = 0;
  private toClientAt = 0;

  constructor(
    private readonly net: SimNetwork,
    private readonly index: number,
    private readonly viewer: Viewer,
  ) {}

  open(handlers: TransportHandlers): void {
    this.handlers = handlers;
    if (this.net.down.has(this.index)) {
      this.closed = true;
      setTimeout(() => handlers.onClose('unreachable'), this.net.latencyMs);
      return;
    }
    this.net.register(this.index, this);
    setTimeout(() => {
      if (this.closed) return;
      this.server = this.net.hub.connect({
        viewer: this.viewer,
        send: (text) => this.deliver('toClient', () => this.handlers?.onMessage(text)),
        close: () => this.kill(),
      });
      handlers.onOpen();
    }, this.net.latencyMs);
  }

  send(text: string): void {
    this.deliver('toServer', () => this.server?.message(text));
  }

  /** Closed by the client. */
  close(): void {
    this.shutdown(false);
  }

  /** Cut by the network or the server; the client finds out. */
  kill(): void {
    this.shutdown(true);
  }

  private readonly queues = { toServer: [] as { at: number; fn: () => void }[], toClient: [] as { at: number; fn: () => void }[] };

  /**
   * In order, like TCP: each message waits for the one before it. (One timer per message isn't
   * enough: timers due in the same millisecond can fire out of order, so a ping could overtake hello.)
   */
  private deliver(dir: 'toServer' | 'toClient', fn: () => void): void {
    if (this.closed) return;
    const key = dir === 'toServer' ? 'toServerAt' : 'toClientAt';
    const at = Math.max(Date.now() + this.net.delay(), this[key]);
    this[key] = at;
    const queue = this.queues[dir];
    queue.push({ at, fn });
    if (queue.length === 1) this.pump(dir);
  }

  private pump(dir: 'toServer' | 'toClient'): void {
    const queue = this.queues[dir];
    const head = queue[0];
    if (!head) return;
    setTimeout(
      () => {
        queue.shift();
        if (!this.closed) head.fn();
        this.pump(dir);
      },
      Math.max(0, head.at - Date.now()),
    );
  }

  private shutdown(notifyClient: boolean): void {
    if (this.closed) return;
    this.closed = true;
    this.net.register(this.index, undefined);
    this.server?.close();
    const handlers = this.handlers;
    if (notifyClient && handlers) setTimeout(() => handlers.onClose('connection lost'), 0);
  }
}
