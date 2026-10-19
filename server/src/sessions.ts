/**
 * Server-side sessions. The cookie holds only a random id; what it stands for is here, with Postgres
 * when there is one (so a dev server restart doesn't sign everyone out). A session belongs to the
 * site it was started on.
 */
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { Session, Tier } from '@sync/domain';

export const SESSION_COOKIE = 'sync_session';
// As the legacy app: a day.
export const SESSION_TTL_SECONDS = 60 * 60 * 24;

/**
 * What a session stands for. Whether they're an admin is worked out on each request. `grants`: tiers
 * command gave them on particular missions, by activity id (none in sessions from before grants).
 */
export type SessionData = Omit<Session, 'admin'> & { orgId: string; grants?: Record<string, Tier> };

export interface SessionStore {
  create(data: SessionData): Promise<string>;
  get(id: string): Promise<SessionData | undefined>;
  /** Changes what each of this person's live sessions stands for, keeping its expiry, e.g. when their grants change. */
  updatePerson(personRef: string, change: (data: SessionData) => Promise<SessionData>): Promise<void>;
  remove(id: string): Promise<void>;
}

const newId = () => randomBytes(32).toString('base64url');

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, { data: SessionData; expires: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async create(data: SessionData): Promise<string> {
    const id = newId();
    this.sessions.set(id, { data, expires: this.now() + SESSION_TTL_SECONDS * 1000 });
    return id;
  }

  async get(id: string): Promise<SessionData | undefined> {
    const found = this.sessions.get(id);
    if (found && found.expires <= this.now()) this.sessions.delete(id);
    return found && found.expires > this.now() ? found.data : undefined;
  }

  async updatePerson(personRef: string, change: (data: SessionData) => Promise<SessionData>): Promise<void> {
    for (const [id, found] of this.sessions) {
      if (found.data.personRef === personRef && (await this.get(id))) found.data = await change(found.data);
    }
  }

  async remove(id: string): Promise<void> {
    this.sessions.delete(id);
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id      text PRIMARY KEY,
  data    jsonb NOT NULL,
  expires timestamptz NOT NULL
);`;

export class PostgresSessionStore implements SessionStore {
  private constructor(private readonly pool: pg.Pool) {}

  static async connect(url: string): Promise<PostgresSessionStore> {
    const pool = new pg.Pool({ connectionString: url });
    await pool.query(SCHEMA);
    await pool.query('DELETE FROM sessions WHERE expires <= now()');
    return new PostgresSessionStore(pool);
  }

  async create(data: SessionData): Promise<string> {
    const id = newId();
    await this.pool.query(`INSERT INTO sessions (id, data, expires) VALUES ($1, $2, now() + make_interval(secs => $3))`, [id, data, SESSION_TTL_SECONDS]);
    return id;
  }

  async get(id: string): Promise<SessionData | undefined> {
    const { rows } = await this.pool.query<{ data: SessionData }>('SELECT data FROM sessions WHERE id = $1 AND expires > now()', [id]);
    return rows[0]?.data;
  }

  async updatePerson(personRef: string, change: (data: SessionData) => Promise<SessionData>): Promise<void> {
    const { rows } = await this.pool.query<{ id: string; data: SessionData }>("SELECT id, data FROM sessions WHERE data->>'personRef' = $1 AND expires > now()", [personRef]);
    for (const { id, data } of rows) await this.pool.query('UPDATE sessions SET data = $2 WHERE id = $1 AND expires > now()', [id, await change(data)]);
  }

  async remove(id: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE id = $1', [id]);
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
