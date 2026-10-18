/**
 * The saved-location catalog behind `/api/v1/locations`. It changes rarely and isn't part of
 * activity sync, so it's a plain table: clients fetch it when they search.
 */
import pg from 'pg';
import { matchesLocation, type SavedLocation } from '@sync/domain';

export interface LocationCatalog {
  /** By title; everything for an empty query. Sorted by title. */
  search(query: string): Promise<SavedLocation[]>;
  /** Adds or replaces, by id. */
  put(location: SavedLocation): Promise<void>;
  remove(id: string): Promise<void>;
}

const byTitle = (a: SavedLocation, b: SavedLocation) => a.title.localeCompare(b.title);

export class MemoryLocationCatalog implements LocationCatalog {
  private readonly locations = new Map<string, SavedLocation>();

  constructor(initial: SavedLocation[] = []) {
    for (const l of initial) this.locations.set(l.id, l);
  }

  async search(query: string): Promise<SavedLocation[]> {
    return [...this.locations.values()].filter((l) => matchesLocation(l, query)).sort(byTitle);
  }

  async put(location: SavedLocation): Promise<void> {
    this.locations.set(location.id, location);
  }

  async remove(id: string): Promise<void> {
    this.locations.delete(id);
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS saved_locations (
  id   text PRIMARY KEY,
  data jsonb NOT NULL
);`;

export class PostgresLocationCatalog implements LocationCatalog {
  private constructor(private readonly pool: pg.Pool) {}

  static async connect(url: string): Promise<PostgresLocationCatalog> {
    const pool = new pg.Pool({ connectionString: url });
    await pool.query(SCHEMA);
    return new PostgresLocationCatalog(pool);
  }

  async search(query: string): Promise<SavedLocation[]> {
    const q = query.trim();
    const { rows } = await this.pool.query<{ data: SavedLocation }>(
      q ? `SELECT data FROM saved_locations WHERE position(lower($1) in lower(data->>'title')) > 0` : 'SELECT data FROM saved_locations',
      q ? [q] : [],
    );
    return rows.map((r) => r.data).sort(byTitle);
  }

  async put(location: SavedLocation): Promise<void> {
    await this.pool.query('INSERT INTO saved_locations (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [location.id, location]);
  }

  async remove(id: string): Promise<void> {
    await this.pool.query('DELETE FROM saved_locations WHERE id = $1', [id]);
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}
