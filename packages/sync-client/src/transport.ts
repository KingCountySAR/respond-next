import { PROTOCOL } from '@sync/core';

export interface TransportHandlers {
  onOpen(): void;
  onMessage(text: string): void;
  onClose(reason: string): void;
}

/** One connection attempt. The client makes a new transport for each reconnect. */
export interface Transport {
  open(handlers: TransportHandlers): void;
  send(text: string): void;
  close(): void;
}

export class WebSocketTransport implements Transport {
  private ws: WebSocket | undefined;

  /**
   * `headers` is for Node (its WebSocket takes them; browsers don't), e.g. a session cookie for a
   * script. In a browser, the page's cookies go with the upgrade anyway.
   */
  constructor(
    private readonly url: string,
    private readonly options: { headers?: Record<string, string> } = {},
  ) {}

  open(handlers: TransportHandlers): void {
    const { headers } = this.options;
    const ws = headers ? new WebSocket(this.url, { protocols: [PROTOCOL], headers } as unknown as string[]) : new WebSocket(this.url, PROTOCOL);
    this.ws = ws;
    ws.onopen = () => handlers.onOpen();
    ws.onmessage = (e) => {
      if (typeof e.data === 'string') handlers.onMessage(e.data);
    };
    ws.onclose = (e) => handlers.onClose(`${e.code} ${e.reason}`.trim());
  }

  send(text: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(text);
  }

  close(): void {
    this.ws?.close();
  }
}
