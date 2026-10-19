/**
 * Tiers granted by someone at command, beside what people's groups give them. A grant is for one
 * person (their person ref) on one activity, until it's removed: command there, not everywhere.
 * A change brings the person's sessions up to date and closes their connections (see app.ts).
 */
import pg from 'pg';
import type { Tier, TierGrant } from '@sync/domain';

export interface GrantStore {
  get(personRef: string, activityId: string): Promise<TierGrant | undefined>;
  /** Every activity they have a grant on, and its tier. */
  forPerson(personRef: string): Promise<Record<string, Tier>>;
  set(personRef: string, activityId: string, grant: TierGrant): Promise<void>;
  remove(personRef: string, activityId: string): Promise<void>;
}

export class MemoryGrantStore implements GrantStore {
  private readonly grants = new Map<string, Map<string, TierGrant>>();

  async get(personRef: string, activityId: string): Promise<TierGrant | undefined> {
    return this.grants.get(personRef)?.get(activityId);
  }

  async forPerson(personRef: string): Promise<Record<string, Tier>> {
    return Object.fromEntries([...(this.grants.get(personRef) ?? [])].map(([activityId, g]) => [activityId, g.tier]));
  }

  async set(personRef: string, activityId: string, grant: TierGrant): Promise<void> {
    const theirs = this.grants.get(personRef) ?? new Map<string, TierGrant>();
    this.grants.set(personRef, theirs.set(activityId, grant));
  }

  async remove(personRef: string, activityId: string): Promise<void> {
    this.grants.get(personRef)?.delete(activityId);
  }
}

// tier_grants was one grant per person, for every activity.
const SCHEMA = `
DROP TABLE IF EXISTS tier_grants;
CREATE TABLE IF NOT EXISTS activity_grants (
  person_ref  text NOT NULL,
  activity_id text NOT NULL,
  tier        text NOT NULL,
  granted_by  text NOT NULL,
  granted_at  timestamptz NOT NULL,
  PRIMARY KEY (person_ref, activity_id)
);`;

export class PostgresGrantStore implements GrantStore {
  private constructor(private readonly pool: pg.Pool) {}

  static async connect(url: string): Promise<PostgresGrantStore> {
    const pool = new pg.Pool({ connectionString: url });
    await pool.query(SCHEMA);
    return new PostgresGrantStore(pool);
  }

  async get(personRef: string, activityId: string): Promise<TierGrant | undefined> {
    const { rows } = await this.pool.query<{ tier: Tier; granted_by: string; granted_at: Date }>(
      'SELECT tier, granted_by, granted_at FROM activity_grants WHERE person_ref = $1 AND activity_id = $2',
      [personRef, activityId],
    );
    const row = rows[0];
    return row && { tier: row.tier, grantedBy: row.granted_by, grantedAt: row.granted_at.getTime() };
  }

  async forPerson(personRef: string): Promise<Record<string, Tier>> {
    const { rows } = await this.pool.query<{ activity_id: string; tier: Tier }>('SELECT activity_id, tier FROM activity_grants WHERE person_ref = $1', [personRef]);
    return Object.fromEntries(rows.map((r) => [r.activity_id, r.tier]));
  }

  async set(personRef: string, activityId: string, grant: TierGrant): Promise<void> {
    await this.pool.query(
      `INSERT INTO activity_grants (person_ref, activity_id, tier, granted_by, granted_at) VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))
       ON CONFLICT (person_ref, activity_id) DO UPDATE SET tier = EXCLUDED.tier, granted_by = EXCLUDED.granted_by, granted_at = EXCLUDED.granted_at`,
      [personRef, activityId, grant.tier, grant.grantedBy, grant.grantedAt],
    );
  }

  async remove(personRef: string, activityId: string): Promise<void> {
    await this.pool.query('DELETE FROM activity_grants WHERE person_ref = $1 AND activity_id = $2', [personRef, activityId]);
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
