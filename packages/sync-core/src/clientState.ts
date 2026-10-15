import { mutationCtx, type MutationDef, type MutationRegistry, type Viewer } from './mutation';
import type { ServerMessage, WireMutation } from './protocol';
import { keyOf, recKey, type Rec } from './records';
import { Rejection } from './errors';
import { MapView, OverlayTx, type ReadView } from './tx';

/** What the UI reads: confirmed server state with pending mutations applied on top. Immutable. */
export interface EventSnapshot extends ReadView {
  readonly version: number;
  readonly pending: readonly WireMutation[];
  /** Keys (`type/id`) of records touched by pending mutations, for "unsynced" markers. */
  readonly pendingKeys: ReadonlySet<string>;
  all(): Iterable<Rec>;
}

export interface PersistedEvent {
  confirmed: Rec[];
  version: number;
  pending: WireMutation[];
}

type UpdateMessage = Extract<ServerMessage, { t: 'update' }>;
type ResetMessage = Extract<ServerMessage, { t: 'reset' }>;

class Snapshot implements EventSnapshot {
  constructor(
    private readonly view: OverlayTx,
    private readonly confirmed: ReadonlyMap<string, Rec>,
    readonly version: number,
    readonly pending: readonly WireMutation[],
    readonly pendingKeys: ReadonlySet<string>,
  ) {}

  get<T extends Rec = Rec>(type: string, id: string): T | undefined {
    return this.view.get<T>(type, id);
  }

  scan<T extends Rec = Rec>(type: string): Iterable<T> {
    return this.view.scan<T>(type);
  }

  *all(): Generator<Rec> {
    for (const [key, r] of this.confirmed) if (!this.view.writes.has(key)) yield r;
    for (const w of this.view.writes.values()) if (!w.deleted) yield w;
  }
}

/**
 * One event on the client: confirmed server state plus the queue of pending mutations.
 * There is no rollback code; the snapshot is rebuilt from confirmed state whenever either changes.
 */
export class ClientEventState {
  private confirmed = new Map<string, Rec>();
  version = 0;
  pending: WireMutation[] = [];
  snapshot: EventSnapshot;

  constructor(
    readonly eventId: string,
    private readonly registry: MutationRegistry,
    private readonly viewer: Viewer,
    private readonly clientId: string,
  ) {
    this.snapshot = this.rebuild();
  }

  restore(saved: PersistedEvent): void {
    this.confirmed = new Map(saved.confirmed.map((r) => [recKey(r), r]));
    this.version = saved.version;
    this.pending = [...saved.pending];
    this.snapshot = this.rebuild();
  }

  persisted(): PersistedEvent {
    return { confirmed: [...this.confirmed.values()], version: this.version, pending: this.pending };
  }

  /** Runs a new local mutation against the current view. Throws Rejection, without queueing, if it fails. */
  addLocal(m: WireMutation): void {
    const def = this.def(m);
    def.run(new OverlayTx(this.snapshot), m.args, mutationCtx(this.viewer, this.clientId, m.id, 'client'));
    this.pending = [...this.pending, m];
    this.snapshot = this.rebuild();
  }

  applyReset(msg: ResetMessage): void {
    this.confirmed = new Map(msg.records.map((r) => [recKey(r), r]));
    this.version = msg.to;
    this.confirm(msg.lastMutationId);
  }

  /** Returns false when the update doesn't follow on from our version; the caller resubscribes. */
  applyUpdate(msg: UpdateMessage): boolean {
    if (msg.from !== this.version) return false;
    const next = new Map(this.confirmed);
    for (const r of msg.upserts) next.set(recKey(r), r);
    for (const d of msg.deletes) next.delete(keyOf(d.type, d.id));
    this.confirmed = next;
    this.version = msg.to;
    this.confirm(msg.lastMutationId);
    return true;
  }

  /** Drops a rejected mutation. Returns it with its description, or undefined if it was already gone. */
  applyReject(mutationId: number): { mutation: WireMutation; description: string } | undefined {
    const mutation = this.pending.find((p) => p.id === mutationId);
    if (!mutation) return undefined;
    const description = this.describe(mutation);
    this.pending = this.pending.filter((p) => p.id !== mutationId);
    this.snapshot = this.rebuild();
    return { mutation, description };
  }

  describe(m: WireMutation): string {
    try {
      return this.def(m).describe(m.args, this.snapshot);
    } catch {
      return m.name;
    }
  }

  private confirm(lastMutationId: number): void {
    this.pending = this.pending.filter((p) => p.id > lastMutationId);
    this.snapshot = this.rebuild();
  }

  private def(m: WireMutation): MutationDef {
    const def = this.registry.get(m.name, m.v);
    if (!def) throw new Rejection('unknown_mutation', `Unknown change type ${m.name}`);
    return def;
  }

  private rebuild(): EventSnapshot {
    const view = new OverlayTx(new MapView(this.confirmed));
    const pendingKeys = new Set<string>();
    for (const m of this.pending) {
      const def = this.registry.get(m.name, m.v);
      if (!def) continue;
      const tx = new OverlayTx(view);
      try {
        def.run(tx, m.args, mutationCtx(this.viewer, this.clientId, m.id, 'client'));
      } catch {
        // Fails against newer state: hidden from the view, but stays pending until the server answers.
        continue;
      }
      for (const [key, r] of tx.writes) {
        view.writes.set(key, r);
        pendingKeys.add(key);
      }
    }
    return new Snapshot(view, this.confirmed, this.version, this.pending, pendingKeys);
  }
}
