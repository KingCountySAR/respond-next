import { recKey, type Rec } from '@sync/core';

export interface LogEntry {
  activityId: string;
  /** Activity version after this entry; for a rejection, the unchanged version. */
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

export interface StoredActivity {
  version: number;
  /** Includes tombstones, so catch-up can send deletes. */
  records: Rec[];
  lastMutationIds: Record<string, number>;
}

export interface CommitBatch {
  /** The stored version this batch builds on; a mismatch means another process wrote the activity. */
  fromVersion: number;
  version: number;
  records: Rec[];
  lastMutationIds: Record<string, number>;
  log: LogEntry[];
}

/**
 * The stored activity moved on without us: another process owns it, or owned it briefly.
 * The in-memory actor is stale and must be reloaded.
 */
export class StorageConflictError extends Error {
  constructor(
    readonly activityId: string,
    readonly expectedVersion: number,
  ) {
    super(`Activity ${activityId} is no longer at version ${expectedVersion}; another process wrote it`);
    this.name = 'StorageConflictError';
  }
}

/**
 * Persistence for activity actors. Each commit is atomic (records, client mutation ids and log
 * together) and fails with StorageConflictError unless the stored version equals `fromVersion`.
 */
export interface ActivityStorage {
  load(activityId: string): Promise<StoredActivity | undefined>;
  commit(activityId: string, batch: CommitBatch): Promise<void>;
  /** The latest log entries for an activity, oldest first; for debugging tools. */
  recentLog(activityId: string, limit: number): Promise<LogEntry[]>;
  /** Every stored activity's id, e.g. to rebuild summaries. */
  activityIds(): Promise<string[]>;
}

/** In-memory storage for development and tests. PostgresStorage implements the same interface. */
export class MemoryStorage implements ActivityStorage {
  private readonly activities = new Map<string, { version: number; records: Map<string, Rec>; lastMutationIds: Map<string, number> }>();
  readonly log: LogEntry[] = [];

  async load(activityId: string): Promise<StoredActivity | undefined> {
    const e = this.activities.get(activityId);
    if (!e) return undefined;
    return { version: e.version, records: [...e.records.values()], lastMutationIds: Object.fromEntries(e.lastMutationIds) };
  }

  async commit(activityId: string, batch: CommitBatch): Promise<void> {
    let e = this.activities.get(activityId);
    if ((e?.version ?? 0) !== batch.fromVersion) throw new StorageConflictError(activityId, batch.fromVersion);
    if (!e) {
      e = { version: 0, records: new Map(), lastMutationIds: new Map() };
      this.activities.set(activityId, e);
    }
    e.version = batch.version;
    for (const r of batch.records) e.records.set(recKey(r), r);
    for (const [clientId, id] of Object.entries(batch.lastMutationIds)) e.lastMutationIds.set(clientId, Math.max(id, e.lastMutationIds.get(clientId) ?? 0));
    this.log.push(...batch.log);
  }

  async recentLog(activityId: string, limit: number): Promise<LogEntry[]> {
    return this.log.filter((e) => e.activityId === activityId).slice(-limit);
  }

  async activityIds(): Promise<string[]> {
    return [...this.activities.keys()];
  }
}
