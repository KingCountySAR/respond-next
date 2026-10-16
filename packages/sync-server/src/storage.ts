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
  /** The stored version this batch builds on; a mismatch means another process wrote the event. */
  fromVersion: number;
  version: number;
  records: Rec[];
  lastMutationIds: Record<string, number>;
  log: LogEntry[];
}

/**
 * The stored event moved on without us: another process owns it, or owned it briefly.
 * The in-memory actor is stale and must be reloaded.
 */
export class StorageConflictError extends Error {
  constructor(
    readonly eventId: string,
    readonly expectedVersion: number,
  ) {
    super(`Event ${eventId} is no longer at version ${expectedVersion}; another process wrote it`);
    this.name = 'StorageConflictError';
  }
}

/**
 * Persistence for event actors. Each commit is atomic (records, client mutation ids and log
 * together) and fails with StorageConflictError unless the stored version equals `fromVersion`.
 */
export interface EventStorage {
  load(eventId: string): Promise<StoredEvent | undefined>;
  commit(eventId: string, batch: CommitBatch): Promise<void>;
  /** The latest log entries for an event, oldest first; for debugging tools. */
  recentLog(eventId: string, limit: number): Promise<LogEntry[]>;
}

/** In-memory storage for development and tests. PostgresStorage implements the same interface. */
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
    if ((e?.version ?? 0) !== batch.fromVersion) throw new StorageConflictError(eventId, batch.fromVersion);
    if (!e) {
      e = { version: 0, records: new Map(), lastMutationIds: new Map() };
      this.events.set(eventId, e);
    }
    e.version = batch.version;
    for (const r of batch.records) e.records.set(recKey(r), r);
    for (const [clientId, id] of Object.entries(batch.lastMutationIds)) e.lastMutationIds.set(clientId, Math.max(id, e.lastMutationIds.get(clientId) ?? 0));
    this.log.push(...batch.log);
  }

  async recentLog(eventId: string, limit: number): Promise<LogEntry[]> {
    return this.log.filter((e) => e.eventId === eventId).slice(-limit);
  }
}
