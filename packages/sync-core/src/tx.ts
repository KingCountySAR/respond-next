import { Rejection } from './errors';
import { keyOf, recKey, type Rec, type RecInput } from './records';

/** Read access to an activity's records. Deleted records are invisible. */
export interface ReadView {
  get<T extends Rec = Rec>(type: string, id: string): T | undefined;
  scan<T extends Rec = Rec>(type: string): Iterable<T>;
  /**
   * Records of a type whose `field` equals `value`. Optional: a view with an index (the UI's
   * observable store) answers without scanning, so a reader depends only on the matching records.
   * Call it through `scanWhere()`, which falls back to filtering `scan`.
   */
  scanWhere?<T extends Rec = Rec>(type: string, field: string, value: unknown): Iterable<T>;
}

export function* scanWhere<T extends Rec = Rec>(view: ReadView, type: string, field: string, value: unknown): Generator<T> {
  if (view.scanWhere) {
    yield* view.scanWhere<T>(type, field, value);
    return;
  }
  for (const r of view.scan<T>(type)) if (r[field] === value) yield r;
}

/** What mutation code reads and writes through. */
export interface Tx extends ReadView {
  /** Creates or fully replaces a record. */
  put(rec: RecInput): void;
  /**
   * Merges fields into an existing record; rejects if it doesn't exist.
   * Prefer this over `put` for edits: a limited client only holds a projection of the record,
   * so a full replacement built from what it can see would drop fields on the server.
   */
  update(type: string, id: string, patch: Record<string, unknown>): void;
  delete(type: string, id: string): void;
}

/** A ReadView over a map that may hold tombstones. */
export class MapView implements ReadView {
  constructor(private readonly map: ReadonlyMap<string, Rec>) {}

  get<T extends Rec = Rec>(type: string, id: string): T | undefined {
    const r = this.map.get(keyOf(type, id));
    return (r && !r.deleted ? r : undefined) as T | undefined;
  }

  *scan<T extends Rec = Rec>(type: string): Generator<T> {
    for (const r of this.map.values()) if (r.type === type && !r.deleted) yield r as T;
  }
}

/** Collects writes over a base view without touching it. Deletes are kept as tombstones. */
export class OverlayTx implements Tx {
  readonly writes = new Map<string, Rec>();

  constructor(private readonly base: ReadView) {}

  get<T extends Rec = Rec>(type: string, id: string): T | undefined {
    const w = this.writes.get(keyOf(type, id));
    if (w) return (w.deleted ? undefined : w) as T | undefined;
    return this.base.get<T>(type, id);
  }

  *scan<T extends Rec = Rec>(type: string): Generator<T> {
    for (const r of this.base.scan<T>(type)) if (!this.writes.has(recKey(r))) yield r;
    for (const w of this.writes.values()) if (w.type === type && !w.deleted) yield w as T;
  }

  put(rec: RecInput): void {
    this.writes.set(recKey(rec), { ...rec, version: 0 });
  }

  update(type: string, id: string, patch: Record<string, unknown>): void {
    const current = this.get(type, id);
    if (!current) throw new Rejection('not_found', `That ${type} no longer exists`);
    this.writes.set(keyOf(type, id), { ...current, ...patch, type, id, version: 0 });
  }

  delete(type: string, id: string): void {
    this.writes.set(keyOf(type, id), { type, id, version: 0, deleted: true });
  }
}
