import { z } from 'zod';
import type { Rec } from './records';

/** WebSocket subprotocol; also names the encoding so others can be added later. */
export const PROTOCOL = 'sync.v1.json';

const WireMutation = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  v: z.number().int().positive(),
  args: z.unknown(),
  clientTime: z.number(),
});
export type WireMutation = z.infer<typeof WireMutation>;

/** Messages from client to server. Parsed with zod because they're untrusted. */
export const ClientMessage = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('hello'),
    // Restricted because it becomes a storage field name (lastMutationIds.<clientId>).
    clientId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'clientId must be 1-64 letters, digits, _ or -'),
    build: z.string(),
    subs: z.array(z.object({ eventId: z.string().min(1), since: z.number().int().min(0) })),
  }),
  z.object({ t: z.literal('sub'), eventId: z.string().min(1), since: z.number().int().min(0) }),
  z.object({ t: z.literal('unsub'), eventId: z.string().min(1) }),
  z.object({ t: z.literal('push'), eventId: z.string().min(1), mutations: z.array(WireMutation).min(1) }),
  z.object({ t: z.literal('ping'), n: z.number() }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

export interface RecRef {
  type: string;
  id: string;
}

/** Messages from server to client. */
export type ServerMessage =
  | {
      t: 'update';
      eventId: string;
      from: number;
      to: number;
      upserts: Rec[];
      deletes: RecRef[];
      lastMutationId: number;
    }
  | { t: 'reset'; eventId: string; to: number; records: Rec[]; lastMutationId: number }
  | { t: 'reject'; eventId: string; mutationId: number; reason: string; message: string }
  | { t: 'pong'; n: number; serverTime: number }
  | { t: 'reload'; reason: string }
  | { t: 'error'; code: string; message: string };

// The single place to swap the wire encoding.
export const encode = (msg: ClientMessage | ServerMessage): string => JSON.stringify(msg);
export const decode = (text: string): unknown => JSON.parse(text);
