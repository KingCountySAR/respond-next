import { PROTOCOL } from '@sync/core';
import type { Transport, TransportHandlers } from '@sync/client';

/** Per-pane network conditions: added latency and an offline switch. */
export class SimLink {
  latencyMs = 0;
  online = true;
  private readonly listeners = new Set<() => void>();

  set(changes: Partial<Pick<SimLink, 'latencyMs' | 'online'>>): void {
    Object.assign(this, changes);
    for (const l of this.listeners) l();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

/** A real WebSocket with simulated latency (order preserved, like TCP) and the ability to go offline. */
export class SimTransport implements Transport {
  private ws: WebSocket | undefined;
  private unsubscribe: (() => void) | undefined;
  private outAt = 0;
  private inAt = 0;

  constructor(
    private readonly url: string,
    private readonly link: SimLink,
  ) {}

  open(handlers: TransportHandlers): void {
    if (!this.link.online) {
      setTimeout(() => handlers.onClose('offline'), 250);
      return;
    }
    const ws = new WebSocket(this.url, PROTOCOL);
    this.ws = ws;
    ws.onopen = () => this.later('in', () => handlers.onOpen());
    ws.onmessage = (e) => this.later('in', () => handlers.onMessage(String(e.data)));
    ws.onclose = (e) => {
      this.unsubscribe?.();
      handlers.onClose(`${e.code} ${e.reason}`.trim());
    };
    this.unsubscribe = this.link.subscribe(() => {
      if (!this.link.online) ws.close(4000, 'simulated offline');
    });
  }

  send(text: string): void {
    this.later('out', () => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(text);
    });
  }

  close(): void {
    this.unsubscribe?.();
    this.ws?.close();
  }

  private later(dir: 'in' | 'out', fn: () => void): void {
    const oneWay = (this.link.latencyMs / 2) * (0.75 + Math.random() / 2);
    const at = Math.max(Date.now() + oneWay, dir === 'in' ? this.inAt : this.outAt);
    if (dir === 'in') this.inAt = at;
    else this.outAt = at;
    setTimeout(fn, at - Date.now());
  }
}
