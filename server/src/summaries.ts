/**
 * Keeps the activity summaries up to date: after an activity commits, its summary is recomputed and,
 * if it changed, written as the server's own change to the archive (every activity) and the list
 * (open and recent ones: `inActivityList`). Busy moments send one update instead of many: a trailing
 * debounce of 2 s, capped at 5 s (see the design doc). `prune` drops activities that have aged out
 * of the list.
 */
import { MapView, recKey, type ReadView, type Rec } from '@sync/core';
import { ACTIVITY_ARCHIVE_ID, ACTIVITY_LIST_ID, SYSTEM_VIEWER, activitySummary, inActivityList, type ActivitySummary } from '@sync/domain';
import type { ActivityStorage, Hub } from '@sync/server';

export interface SummaryOptions {
  debounceMs?: number;
  maxWaitMs?: number;
  now?(): number;
}

/** JSON with sorted keys, so a summary read back from Postgres (jsonb reorders keys) compares equal. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  );
}

const withoutVersion = ({ version: _version, ...rest }: Rec) => rest;
const isScope = (activityId: string) => activityId === ACTIVITY_LIST_ID || activityId === ACTIVITY_ARCHIVE_ID;

export class SummaryWriter {
  private readonly pending = new Map<string, { timer: ReturnType<typeof setTimeout>; since: number; view: ReadView }>();
  /** Every activity's latest summary, as the archive has it. */
  private readonly summaries = new Map<string, ActivitySummary>();
  /** The last summary written per scope and activity, as stable JSON ('null' when it has none). */
  private readonly written = new Map<string, Map<string, string>>([
    [ACTIVITY_ARCHIVE_ID, new Map()],
    [ACTIVITY_LIST_ID, new Map()],
  ]);
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private readonly now: () => number;

  /** `hub` is a getter because the hub is built with `onCommit` from this writer. */
  constructor(
    private readonly hub: () => Hub,
    options: SummaryOptions = {},
  ) {
    this.debounceMs = options.debounceMs ?? 2000;
    this.maxWaitMs = options.maxWaitMs ?? 5000;
    this.now = options.now ?? Date.now;
  }

  /** Pass as the hub's `onCommit`. */
  readonly onCommit = (activityId: string, view: ReadView): void => {
    if (isScope(activityId)) return;
    const now = Date.now();
    const pending = this.pending.get(activityId);
    if (pending) clearTimeout(pending.timer);
    const since = pending?.since ?? now;
    const wait = Math.max(0, Math.min(this.debounceMs, since + this.maxWaitMs - now));
    this.pending.set(activityId, { since, view, timer: setTimeout(() => void this.write(activityId, view), wait) });
  };

  /**
   * Notes what the archive and list hold, writes summaries for stored activities missing from the
   * archive (those made before it existed; each is loaded once, ever), and prunes the list. Returns
   * how many it added.
   */
  async backfill(storage: ActivityStorage): Promise<number> {
    for (const [scope, written] of this.written) {
      for (const r of (await this.hub().read(scope, SYSTEM_VIEWER)).records) {
        if (r.type !== 'activitySummary') continue;
        written.set(r.id, stableJson(withoutVersion(r)));
        if (scope === ACTIVITY_ARCHIVE_ID) this.summaries.set(r.id, withoutVersion(r) as unknown as ActivitySummary);
      }
    }
    let added = 0;
    for (const id of await storage.activityIds()) {
      if (isScope(id) || this.summaries.has(id)) continue;
      const read = await this.hub().read(id, SYSTEM_VIEWER);
      if (await this.write(id, new MapView(new Map(read.records.map((r) => [recKey(r), r]))))) added++;
    }
    await this.prune();
    return added;
  }

  /** Brings the list in line with the archive: drops activities that have aged out, adds any missing. */
  async prune(): Promise<void> {
    const now = this.now();
    for (const [id, summary] of this.summaries) await this.put(ACTIVITY_LIST_ID, id, inActivityList(summary.activity, now) ? summary : null);
  }

  /** Writes the summary where it changed; true if it wrote any. */
  private async write(activityId: string, view: ReadView): Promise<boolean> {
    this.pending.delete(activityId);
    const summary = activitySummary(view, activityId);
    if (summary) this.summaries.set(activityId, summary);
    else this.summaries.delete(activityId);
    const archived = await this.put(ACTIVITY_ARCHIVE_ID, activityId, summary);
    const listed = await this.put(ACTIVITY_LIST_ID, activityId, summary && inActivityList(summary.activity, this.now()) ? summary : null);
    return archived || listed;
  }

  /** Writes one scope's summary (null removes it) if it isn't what that scope has; true if it did. */
  private async put(scope: string, activityId: string, summary: ActivitySummary | null): Promise<boolean> {
    const written = this.written.get(scope)!;
    const json = stableJson(summary);
    if ((written.get(activityId) ?? 'null') === json) return false;
    written.set(activityId, json);
    try {
      await this.hub().pushAsSystem(scope, SYSTEM_VIEWER, [{ name: 'setActivitySummary', args: { id: activityId, summary } }]);
      return true;
    } catch (err) {
      written.delete(activityId); // try again on the next commit
      console.error(`sync: could not update the summary of ${activityId} in ${scope}`, err);
      return false;
    }
  }
}

