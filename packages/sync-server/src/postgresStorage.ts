import pg from 'pg';
import { recKey, type Rec } from '@sync/core';
import { StorageConflictError, type CommitBatch, type EventStorage, type LogEntry, type StoredEvent } from './storage';

// bigint columns come back as numbers rather than strings; versions and ids stay far below 2^53.
const types = new pg.TypeOverrides();
types.setTypeParser(pg.types.builtins.INT8, Number);

/**
 * Tables. Records are stored whole as jsonb: this layer stays domain-agnostic, and reporting can
 * query the jsonb or get typed views later. `mutation_log.seq` gives the log a strict order;
 * within one event it is commit order, because the version guard serializes that event's commits.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS event_meta (
  event_id text PRIMARY KEY,
  version bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS records (
  event_id text NOT NULL,
  type text NOT NULL,
  id text NOT NULL,
  version bigint NOT NULL,
  rec jsonb NOT NULL,
  PRIMARY KEY (event_id, type, id)
);
CREATE TABLE IF NOT EXISTS client_mutations (
  event_id text NOT NULL,
  client_id text NOT NULL,
  last_mutation_id bigint NOT NULL,
  PRIMARY KEY (event_id, client_id)
);
CREATE TABLE IF NOT EXISTS mutation_log (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id text NOT NULL,
  version bigint NOT NULL,
  client_id text NOT NULL,
  mutation_id bigint NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  outcome text NOT NULL,
  received_at timestamptz NOT NULL,
  entry jsonb NOT NULL,
  UNIQUE (event_id, client_id, mutation_id)
);
CREATE INDEX IF NOT EXISTS mutation_log_event_seq ON mutation_log (event_id, seq);
`;

/** Any fixed number: serializes schema setup when several processes start at once. */
const SCHEMA_LOCK = 0x5359_4e43;

/**
 * PostgreSQL storage. Each commit is one transaction; the version guard is a conditional update
 * of the event's `event_meta` row.
 */
export class PostgresStorage implements EventStorage {
  private constructor(private readonly pool: pg.Pool) {}

  static async connect(url: string): Promise<PostgresStorage> {
    const pool = new pg.Pool({ connectionString: url, types });
    const storage = new PostgresStorage(pool);
    try {
      await storage.transaction(async (db) => {
        await db.query('SELECT pg_advisory_xact_lock($1)', [SCHEMA_LOCK]);
        await db.query(SCHEMA);
      });
    } catch (err) {
      await pool.end();
      throw err;
    }
    return storage;
  }

  close(): Promise<void> {
    return this.pool.end();
  }

  private async transaction<T>(fn: (db: pg.PoolClient) => Promise<T>, begin = 'BEGIN'): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query(begin);
      const result = await fn(db);
      await db.query('COMMIT');
      return result;
    } catch (err) {
      await db.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      db.release();
    }
  }

  async load(eventId: string): Promise<StoredEvent | undefined> {
    // One snapshot, so a commit from another process can't land between the reads.
    return this.transaction(async (db) => {
      const meta = await db.query<{ version: number }>('SELECT version FROM event_meta WHERE event_id = $1', [eventId]);
      const version = meta.rows[0]?.version;
      if (version === undefined) return undefined;
      const records = await db.query<{ rec: Rec }>('SELECT rec FROM records WHERE event_id = $1', [eventId]);
      const clients = await db.query<{ client_id: string; last_mutation_id: number }>('SELECT client_id, last_mutation_id FROM client_mutations WHERE event_id = $1', [eventId]);
      return {
        version,
        records: records.rows.map((r) => r.rec),
        lastMutationIds: Object.fromEntries(clients.rows.map((c) => [c.client_id, c.last_mutation_id])),
      };
    }, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  }

  async commit(eventId: string, batch: CommitBatch): Promise<void> {
    await this.transaction(async (db) => {
      // Version guard first. A concurrent commit to the same event holds the row lock; once it
      // commits, the version no longer matches and this one matches no rows.
      const guard =
        batch.fromVersion === 0
          ? await db.query('INSERT INTO event_meta (event_id, version) VALUES ($1, $2) ON CONFLICT DO NOTHING', [eventId, batch.version])
          : await db.query('UPDATE event_meta SET version = $2 WHERE event_id = $1 AND version = $3', [eventId, batch.version, batch.fromVersion]);
      if (guard.rowCount === 0) throw new StorageConflictError(eventId, batch.fromVersion);

      // An upsert can't touch the same row twice in one statement: keep each record's last write.
      const records = [...new Map(batch.records.map((r) => [recKey(r), r])).values()];
      if (records.length > 0) {
        await db.query(
          `INSERT INTO records (event_id, type, id, version, rec)
           SELECT $1, r->>'type', r->>'id', (r->>'version')::bigint, r FROM jsonb_array_elements($2::jsonb) AS r
           ON CONFLICT (event_id, type, id) DO UPDATE SET version = excluded.version, rec = excluded.rec`,
          [eventId, JSON.stringify(records)],
        );
      }

      if (Object.keys(batch.lastMutationIds).length > 0) {
        await db.query(
          `INSERT INTO client_mutations (event_id, client_id, last_mutation_id)
           SELECT $1, key, value::bigint FROM jsonb_each_text($2::jsonb)
           ON CONFLICT (event_id, client_id) DO UPDATE
             SET last_mutation_id = greatest(client_mutations.last_mutation_id, excluded.last_mutation_id)`,
          [eventId, JSON.stringify(batch.lastMutationIds)],
        );
      }

      if (batch.log.length > 0) {
        await db.query(
          `INSERT INTO mutation_log (event_id, version, client_id, mutation_id, user_id, name, outcome, received_at, entry)
           SELECT e->>'eventId', (e->>'version')::bigint, e->>'clientId', (e->>'mutationId')::bigint, e->>'userId', e->>'name',
                  e->>'outcome', to_timestamp((e->>'receivedAt')::double precision / 1000), e
           FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS t(e, n) ORDER BY n`,
          [JSON.stringify(batch.log)],
        );
      }
    });
  }

  async recentLog(eventId: string, limit: number): Promise<LogEntry[]> {
    const res = await this.pool.query<{ entry: LogEntry }>('SELECT entry FROM mutation_log WHERE event_id = $1 ORDER BY seq DESC LIMIT $2', [eventId, limit]);
    return res.rows.map((r) => r.entry).reverse();
  }
}
