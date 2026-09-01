/**
 * Who authored an event. Every minted event is stamped with an author and a
 * timestamp on the server; together with the append-only `events` collection
 * these form the audit log. A `user` author is a signed-in person; a `service`
 * author is server-side automation (e.g. a reactor).
 */
export type EventAuthor = { type: 'user'; id: string; email: string } | { type: 'service'; id: string };

export interface EventMeta {
  author: EventAuthor;
  /** Epoch millis the server minted the event. */
  timestamp: number;
}

export function userAuthor(id: string, email: string): EventAuthor {
  return { type: 'user', id, email };
}

export function serviceAuthor(id: string): EventAuthor {
  return { type: 'service', id };
}
