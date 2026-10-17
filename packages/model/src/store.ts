/**
 * An activity's records as MobX observables, fed from the client's snapshots. It is a `ReadView`, so
 * the domain queries run over it unchanged, and MobX tracks exactly which records each one read.
 */
import { action, observable, type ObservableMap } from 'mobx';
import { keyOf, type ActivitySnapshot, type ReadView, type Rec } from '@sync/core';

type Bucket = ObservableMap<string, Rec>;

class TypeTable {
  readonly records: Bucket = observable.map({}, { deep: false });
  /** field -> value -> the records with that value. Buckets are made on first read or write. */
  readonly indexes = new Map<string, Map<unknown, Bucket>>();

  constructor(fields: readonly string[]) {
    for (const f of fields) this.indexes.set(f, new Map());
  }

  bucket(field: string, value: unknown): Bucket | undefined {
    const index = this.indexes.get(field);
    if (!index) return undefined;
    let b = index.get(value);
    if (!b) index.set(value, (b = observable.map({}, { deep: false })));
    return b;
  }
}

export class RecordStore implements ReadView {
  private readonly tables = new Map<string, TypeTable>();
  /** Plain copy of what's stored, for change detection without touching observables. */
  private readonly current = new Map<string, Rec>();
  private readonly pendingBox = observable.box<ReadonlySet<string>>(new Set(), { deep: false });

  constructor(private readonly indexes: Readonly<Record<string, readonly string[]>> = {}) {}

  get<T extends Rec = Rec>(type: string, id: string): T | undefined {
    return this.table(type).records.get(id) as T | undefined;
  }

  scan<T extends Rec = Rec>(type: string): Iterable<T> {
    return this.table(type).records.values() as Iterable<T>;
  }

  scanWhere<T extends Rec = Rec>(type: string, field: string, value: unknown): Iterable<T> {
    const bucket = this.table(type).bucket(field, value);
    if (bucket) return bucket.values() as Iterable<T>;
    return [...this.scan<T>(type)].filter((r) => r[field] === value);
  }

  /** Whether a pending (unconfirmed) local change touched this record. */
  isPending(type: string, id: string): boolean {
    return this.pendingBox.get().has(keyOf(type, id));
  }

  /** Brings the observables in line with a snapshot, writing only records that changed. */
  readonly apply = action((snap: ActivitySnapshot): void => {
    const seen = new Set<string>();
    for (const r of snap.all()) {
      const key = keyOf(r.type, r.id);
      seen.add(key);
      const prev = this.current.get(key);
      // Confirmed records the change didn't touch keep their object, so this is usually an identity check.
      // Pending ones are rebuilt on every snapshot, so they're compared by value.
      if (prev === r || (prev && sameValue(prev, r))) continue;
      this.write(prev, r);
    }
    for (const [key, prev] of this.current) if (!seen.has(key)) this.write(prev, undefined);
    if (!sameKeys(this.pendingBox.get(), snap.pendingKeys)) this.pendingBox.set(snap.pendingKeys);
  });

  private write(prev: Rec | undefined, next: Rec | undefined): void {
    const r = (next ?? prev)!;
    const table = this.table(r.type);
    for (const [field] of table.indexes) {
      if (prev && (!next || prev[field] !== next[field])) table.bucket(field, prev[field])!.delete(r.id);
    }
    if (next) {
      table.records.set(r.id, next);
      for (const [field] of table.indexes) table.bucket(field, next[field])!.set(r.id, next);
      this.current.set(keyOf(r.type, r.id), next);
    } else {
      table.records.delete(r.id);
      this.current.delete(keyOf(r.type, r.id));
    }
  }

  private table(type: string): TypeTable {
    let t = this.tables.get(type);
    if (!t) this.tables.set(type, (t = new TypeTable(this.indexes[type] ?? [])));
    return t;
  }
}

function sameKeys(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

/** Deep equality for record values (plain JSON data). */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
