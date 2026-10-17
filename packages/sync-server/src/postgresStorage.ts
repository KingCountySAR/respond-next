import pg from 'pg';
import { recKey, type Rec } from '@sync/core';
import { StorageConflictError, type CommitBatch, type ActivityStorage, type LogEntry, type StoredActivity } from './storage';

// bigint columns come back as numbers rather than strings; versions and ids stay far below 2^53.
const types = new pg.TypeOverrides();
types.setTypeParser(pg.types.builtins.INT8, Number);

/**
 * Tables. Records are stored whole as jsonb: this layer stays domain-agnostic, and reporting can
 * query the jsonb or get typed views later. `mutation_log.seq` gives the log a strict order;
 * within one activity it is commit order, because the version guard serializes that activity's commits.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS activity_meta (
  activity_id text PRIMARY KEY,
  version bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS records (
  activity_id text NOT NULL,
  type text NOT NULL,
  id text NOT NULL,
  version bigint NOT NULL,
  rec jsonb NOT NULL,
  PRIMARY KEY (activity_id, type, id)
);
CREATE TABLE IF NOT EXISTS client_mutations (
  activity_id text NOT NULL,
  client_id text NOT NULL,
  last_mutation_id bigint NOT NULL,
  PRIMARY KEY (activity_id, client_id)
);
CREATE TABLE IF NOT EXISTS mutation_log (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  activity_id text NOT NULL,
  version bigint NOT NULL,
  client_id text NOT NULL,
  mutation_id bigint NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  outcome text NOT NULL,
  received_at timestamptz NOT NULL,
  entry jsonb NOT NULL,
  UNIQUE (activity_id, client_id, mutation_id)
);
CREATE INDEX IF NOT EXISTS mutation_log_activity_seq ON mutation_log (activity_id, seq);
`;

/** Any fixed number: serializes schema setup when several processes start at once. */
const SCHEMA_LOCK = 0x5359_4e43;

/**
 * PostgreSQL storage. Each commit is one transaction; the version guard is a conditional update
 * of the activity's `activity_meta` row.
 */
export class PostgresStorage implements ActivityStorage {
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

  async load(activityId: string): Promise<StoredActivity | undefined> {
    // One snapshot, so a commit from another process can't land between the reads.
    return this.transaction(async (db) => {
      const meta = await db.query<{ version: number }>('SELECT version FROM activity_meta WHERE activity_id = $1', [activityId]);
      const version = meta.rows[0]?.version;
      if (version === undefined) return undefined;
      const records = await db.query<{ rec: Rec }>('SELECT rec FROM records WHERE activity_id = $1', [activityId]);
      const clients = await db.query<{ client_id: string; last_mutation_id: number }>('SELECT client_id, last_mutation_id FROM client_mutations WHERE activity_id = $1', [activityId]);
      return {
        version,
        records: records.rows.map((r) => r.rec),
        lastMutationIds: Object.fromEntries(clients.rows.map((c) => [c.client_id, c.last_mutation_id])),
      };
    }, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  }

  async commit(activityId: string, batch: CommitBatch): Promise<void> {
    await this.transaction(async (db) => {
      // Version guard first. A concurrent commit to the same activity holds the row lock; once it
      // commits, the version no longer matches and this one matches no rows.
      const guard =
        batch.fromVersion === 0
          ? await db.query('INSERT INTO activity_meta (activity_id, version) VALUES ($1, $2) ON CONFLICT DO NOTHING', [activityId, batch.version])
          : await db.query('UPDATE activity_meta SET version = $2 WHERE activity_id = $1 AND version = $3', [activityId, batch.version, batch.fromVersion]);
      if (guard.rowCount === 0) throw new StorageConflictError(activityId, batch.fromVersion);

      // An upsert can't touch the same row twice in one statement: keep each record's last write.
      const records = [...new Map(batch.records.map((r) => [recKey(r), r])).values()];
      if (records.length > 0) {
        await db.query(
          `INSERT INTO records (activity_id, type, id, version, rec)
           SELECT $1, r->>'type', r->>'id', (r->>'version')::bigint, r FROM jsonb_array_elements($2::jsonb) AS r
           ON CONFLICT (activity_id, type, id) DO UPDATE SET version = excluded.version, rec = excluded.rec`,
          [activityId, JSON.stringify(records)],
        );
      }

      if (Object.keys(batch.lastMutationIds).length > 0) {
        await db.query(
          `INSERT INTO client_mutations (activity_id, client_id, last_mutation_id)
           SELECT $1, key, value::bigint FROM jsonb_each_text($2::jsonb)
           ON CONFLICT (activity_id, client_id) DO UPDATE
             SET last_mutation_id = greatest(client_mutations.last_mutation_id, excluded.last_mutation_id)`,
          [activityId, JSON.stringify(batch.lastMutationIds)],
        );
      }

      if (batch.log.length > 0) {
        await db.query(
          `INSERT INTO mutation_log (activity_id, version, client_id, mutation_id, user_id, name, outcome, received_at, entry)
           SELECT e->>'activityId', (e->>'version')::bigint, e->>'clientId', (e->>'mutationId')::bigint, e->>'userId', e->>'name',
                  e->>'outcome', to_timestamp((e->>'receivedAt')::double precision / 1000), e
           FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS t(e, n) ORDER BY n`,
          [JSON.stringify(batch.log)],
        );
      }
    });
  }

  async recentLog(activityId: string, limit: number): Promise<LogEntry[]> {
    const res = await this.pool.query<{ entry: LogEntry }>('SELECT entry FROM mutation_log WHERE activity_id = $1 ORDER BY seq DESC LIMIT $2', [activityId, limit]);
    return res.rows.map((r) => r.entry).reverse();
  }
}
