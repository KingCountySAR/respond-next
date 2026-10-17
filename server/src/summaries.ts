/**
 * Keeps the activity list up to date: after an activity commits, its summary is recomputed and,
 * if it changed, written to the list scope as the server's own change. Busy moments send one
 * update instead of many: a trailing debounce of 2 s, capped at 5 s (see the design doc).
 */
import { MapView, recKey, type ReadView, type Rec } from '@sync/core';
import { ACTIVITY_LIST_ID, SYSTEM_VIEWER, activitySummary } from '@sync/domain';
import type { ActivityStorage, Hub } from '@sync/server';

export interface SummaryOptions {
  debounceMs?: number;
  maxWaitMs?: number;
}

/** JSON with sorted keys, so a summary read back from Postgres (jsonb reorders keys) compares equal. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  );
}

const withoutVersion = ({ version: _version, ...rest }: Rec) => rest;

export class SummaryWriter {
  private readonly pending = new Map<string, { timer: ReturnType<typeof setTimeout>; since: number; view: ReadView }>();
  /** The last summary written per activity, as stable JSON ('null' when it has none). */
  private readonly written = new Map<string, string>();
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;

  /** `hub` is a getter because the hub is built with `onCommit` from this writer. */
  constructor(
    private readonly hub: () => Hub,
    options: SummaryOptions = {},
  ) {
    this.debounceMs = options.debounceMs ?? 2000;
    this.maxWaitMs = options.maxWaitMs ?? 5000;
  }

  /** Pass as the hub's `onCommit`. */
  readonly onCommit = (activityId: string, view: ReadView): void => {
    if (activityId === ACTIVITY_LIST_ID) return;
    const now = Date.now();
    const pending = this.pending.get(activityId);
    if (pending) clearTimeout(pending.timer);
    const since = pending?.since ?? now;
    const wait = Math.max(0, Math.min(this.debounceMs, since + this.maxWaitMs - now));
    this.pending.set(activityId, { since, view, timer: setTimeout(() => void this.write(activityId, view), wait) });
  };

  /**
   * Notes what the list already holds, and writes summaries for stored activities missing from it
   * (those made before summaries existed). Loads each missing activity once.
   */
  async backfill(storage: ActivityStorage): Promise<number> {
    const list = await this.hub().actor(ACTIVITY_LIST_ID);
    for (const r of list.projectedRecords('command')) if (r.type === 'activitySummary') this.written.set(r.id, stableJson(withoutVersion(r)));
    let added = 0;
    for (const id of await storage.activityIds()) {
      if (id === ACTIVITY_LIST_ID || this.written.has(id)) continue;
      const records = (await this.hub().actor(id)).projectedRecords('command');
      if (await this.write(id, new MapView(new Map(records.map((r) => [recKey(r), r]))))) added++;
    }
    return added;
  }

  /** Writes the summary if it changed; true if it wrote one. */
  private async write(activityId: string, view: ReadView): Promise<boolean> {
    this.pending.delete(activityId);
    const summary = activitySummary(view, activityId);
    const json = stableJson(summary);
    if ((this.written.get(activityId) ?? 'null') === json) return false;
    this.written.set(activityId, json);
    try {
      await this.hub().pushAsSystem(ACTIVITY_LIST_ID, SYSTEM_VIEWER, [{ name: 'setActivitySummary', args: { id: activityId, summary } }]);
      return true;
    } catch (err) {
      this.written.delete(activityId); // try again on the next commit
      console.error(`sync: could not update the summary of ${activityId}`, err);
      return false;
    }
  }
}
