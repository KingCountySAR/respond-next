import { recKey, type Rec } from '@sync/core';

export interface LogEntry {
  eventId: string;
  /** Event version after this entry; for a rejection, the unchanged version. */
  version: number;
  mutationId: number;
  clientId: string;
  userId: string;
  name: string;
  v: number;
  args: unknown;
  at?: number;
  clientTime: number;
  receivedAt: number;
  outcome: 'applied' | 'rejected';
  reason?: string;
  effects: { type: string; id: string; before?: Rec; after?: Rec }[];
}

export interface StoredEvent {
  version: number;
  /** Includes tombstones, so catch-up can send deletes. */
  records: Rec[];
  lastMutationIds: Record<string, number>;
}

export interface CommitBatch {
  version: number;
  records: Rec[];
  lastMutationIds: Record<string, number>;
  log: LogEntry[];
}

/** Persistence for event actors. Each commit must be atomic: records, client ids and log together. */
export interface EventStorage {
  load(eventId: string): Promise<StoredEvent | undefined>;
  commit(eventId: string, batch: CommitBatch): Promise<void>;
}

/** In-memory storage for development and tests. MongoDB storage implements the same interface. */
export class MemoryStorage implements EventStorage {
  private readonly events = new Map<string, { version: number; records: Map<string, Rec>; lastMutationIds: Map<string, number> }>();
  readonly log: LogEntry[] = [];

  async load(eventId: string): Promise<StoredEvent | undefined> {
    const e = this.events.get(eventId);
    if (!e) return undefined;
    return { version: e.version, records: [...e.records.values()], lastMutationIds: Object.fromEntries(e.lastMutationIds) };
  }

  async commit(eventId: string, batch: CommitBatch): Promise<void> {
    let e = this.events.get(eventId);
    if (!e) {
      e = { version: 0, records: new Map(), lastMutationIds: new Map() };
      this.events.set(eventId, e);
    }
    e.version = batch.version;
    for (const r of batch.records) e.records.set(recKey(r), r);
    for (const [clientId, id] of Object.entries(batch.lastMutationIds)) e.lastMutationIds.set(clientId, id);
    this.log.push(...batch.log);
  }
}
