/**
 * Writes each activity's log (see `@sync/domain`'s activityLog.ts): after a commit, a readable line
 * for each change, into the activity's log scope as the server's own change, with a copy of the
 * activity record when it changed. One write per commit, in commit order per activity.
 */
import type { ReadView } from '@sync/core';
import { SYSTEM_VIEWER, activityLogId, getActivity, isReservedScope, narrate, type ActivityViewer, type LogLine } from '@sync/domain';
import type { CommittedChange, Hub } from '@sync/server';

export class ActivityLogWriter {
  /** Each activity's writes, in order. */
  private readonly queues = new Map<string, Promise<void>>();
  /** The activity record version each log scope has a copy of. */
  private readonly copied = new Map<string, number>();

  /** `hub` is a getter because the hub is built with `onCommit` from this writer. */
  constructor(private readonly hub: () => Hub) {}

  /** Pass to the hub's `onCommit`. */
  readonly onCommit = (activityId: string, view: ReadView, changes: CommittedChange[]): void => {
    if (isReservedScope(activityId)) return;
    const lines: (LogLine & { id: string })[] = [];
    for (const { entry, viewer } of changes) {
      const v = viewer as ActivityViewer;
      // Ids from the activity's version (padded, so they sort), so writing again leaves the line alone.
      narrate({ name: entry.name, args: entry.args, at: entry.at, receivedAt: entry.receivedAt, effects: entry.effects, actor: { userId: v.userId, name: v.name, personRef: v.personRef } }, view).forEach((line, i) =>
        lines.push({ id: `${String(entry.version).padStart(9, '0')}.${i}`, ...line }),
      );
    }
    const activity = getActivity(view);
    const copy = activity && activity.version !== this.copied.get(activityId) ? activity : undefined;
    if (!lines.length && !copy) return;
    if (copy) this.copied.set(activityId, copy.version);
    const write = async () => {
      try {
        await this.hub().pushAsSystem(activityLogId(activityId), SYSTEM_VIEWER, [{ name: 'appendLog', args: { lines, activity: copy } }]);
      } catch (err) {
        if (copy) this.copied.delete(activityId); // copy it again next time
        console.error(`sync: could not log changes to ${activityId}`, err);
      }
    };
    const next = (this.queues.get(activityId) ?? Promise.resolve()).then(write);
    this.queues.set(activityId, next);
    void next.finally(() => this.queues.get(activityId) === next && this.queues.delete(activityId));
  };

  /** Resolves once everything logged so far is written; for tests. */
  async settled(): Promise<void> {
    await Promise.all([...this.queues.values()]);
  }
}
