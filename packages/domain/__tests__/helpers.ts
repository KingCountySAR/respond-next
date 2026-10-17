import { MapView, OverlayTx, Rejection, keyOf, mutationCtx, recKey, type ReadView, type Rec } from '@sync/core';
import { activityRegistry, type ActivityViewer } from '@sync/domain';

export const COMMAND: ActivityViewer = { userId: 'u-command', tier: 'command', class: 'member' };
export const fieldMember = (personRef: string): ActivityViewer => ({ userId: `u-${personRef}`, tier: 'field', class: 'member', personRef });
export const EXTERNAL: ActivityViewer = { userId: 'u-external', tier: 'field', class: 'external', personRef: 'adhoc:ext-1' };
export const SYSTEM: ActivityViewer = { userId: 'system', tier: 'command', class: 'member' };

export const HOUR = 60 * 60 * 1000;
export const T0 = Date.UTC(2026, 9, 16, 18, 0);

export const CRT = { id: 'org-crt', title: 'Cascade Rescue Team', rosterName: 'CRT' };
export const RMR = { id: 'org-rmr', title: 'Ridgeline Mountain Rescue', rosterName: 'RMR' };

/**
 * One activity's records with the server's apply rules (args parsing, allow, run in a transaction),
 * without the network. Each mutation gets the next id, so new record ids are deterministic.
 */
export class TestActivity {
  readonly records = new Map<string, Rec>();
  version = 0;
  private mutationId = 0;

  get view(): ReadView {
    return new MapView(this.records);
  }

  /** Applies a mutation and returns the records it wrote; throws its Rejection. */
  run(name: string, args: Record<string, unknown>, viewer: ActivityViewer = COMMAND): Rec[] {
    const def = activityRegistry.latest(name);
    if (!def) throw new Error(`no mutation ${name}`);
    if (def.allow && !def.allow(viewer)) throw new Rejection('forbidden', 'Your role cannot make this change');
    const parsed = def.args.safeParse(args);
    if (!parsed.success) throw new Rejection('bad_args', parsed.error.message);
    const tx = new OverlayTx(this.view);
    def.run(tx, parsed.data, mutationCtx(viewer, 'test-client', ++this.mutationId, 'server'));
    this.version += 1;
    const written = [...tx.writes.values()].map((r) => ({ ...r, version: this.version }));
    for (const r of written) this.records.set(recKey(r), r);
    return written;
  }

  /** The Rejection code a mutation fails with, or undefined if it applied. */
  rejects(name: string, args: Record<string, unknown>, viewer?: ActivityViewer): string | undefined {
    try {
      this.run(name, args, viewer);
      return undefined;
    } catch (err) {
      if (err instanceof Rejection) return err.code;
      throw err;
    }
  }

  get<T extends Rec = Rec>(type: string, id: string): T | undefined {
    const r = this.records.get(keyOf(type, id));
    return r && !r.deleted ? (r as T) : undefined;
  }

  all<T extends Rec = Rec>(type: string): T[] {
    return [...this.view.scan<T>(type)];
  }
}

export const activityArgs = (overrides: Record<string, unknown> = {}) => ({
  idNumber: '26-0123',
  kind: 'mission',
  title: 'Lost hiker, Mailbox Peak',
  description: '',
  location: { title: 'Mailbox Peak trailhead', lat: 47.4669, lon: -121.6747, address: null },
  mapId: '',
  startTime: T0,
  ownerOrgId: 'org-kcso',
  mode: 'full',
  standbyOnly: false,
  ...overrides,
});

/** An open activity starting at T0, open for sign-in (the 4-hour default window). */
export function startedActivity(overrides: Record<string, unknown> = {}): TestActivity {
  const e = new TestActivity();
  e.run('createActivity', activityArgs(overrides));
  return e;
}

/** Adds a member as command and returns their participant id. */
export function addMember(e: TestActivity, personRef: string, status = 'staging', unit: { id: string; title: string; rosterName: string | null } = CRT, at = T0 + HOUR): string {
  e.run('addParticipant', { personRef, firstname: personRef.split(':')[1], lastname: 'Tester', unit, status, at });
  return e.all<{ personRef: string } & Rec>('participant').find((p) => p.personRef === personRef)!.id;
}
