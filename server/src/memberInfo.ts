/**
 * Fills in what the member database knows about each person on an activity: their tags (the labels
 * the unit they respond under, and those above it, give their groups) and their phone and email. After a commit, anyone
 * under a unit their tags aren't from (`memberTagsUnitId`) is looked up, and `setMemberInfo` written. Once written they
 * stay, so the activity reads later as it did then.
 */
import type { ReadView } from '@sync/core';
import { SYSTEM_VIEWER, currentUnitOf, isReservedScope, type ParticipantRec } from '@sync/domain';
import type { Hub } from '@sync/server';
import type { MemberDetails } from './members';

/** Where member info comes from: the member providers, by person ref, with the tags of the unit they respond under. */
export interface PersonLookup {
  lookup(personRef: string, unitId?: string): Promise<MemberDetails | undefined>;
}

export class MemberInfoWriter {
  /** `<activity>/<participant>/<personRef>/<unit>` once looked up (or being looked up): a new unit means new tags. */
  private readonly done = new Set<string>();
  private readonly running = new Set<Promise<void>>();

  /** `hub` is a getter because the hub is built with `onCommit` from this writer. */
  constructor(
    private readonly hub: () => Hub,
    private readonly directory: PersonLookup,
  ) {}

  /** Pass to the hub's `onCommit`. */
  readonly onCommit = (activityId: string, view: ReadView): void => {
    if (isReservedScope(activityId)) return;
    for (const p of view.scan<ParticipantRec>('participant')) {
      // Only those under a unit their tags aren't from yet.
      const unitId = currentUnitOf(view, p.id);
      if (!unitId || p.memberTagsUnitId === unitId) continue;
      const key = `${activityId}/${p.id}/${p.personRef}/${unitId}`;
      if (this.done.has(key)) continue;
      this.done.add(key);
      const run = this.write(activityId, p, unitId, key).finally(() => this.running.delete(run));
      this.running.add(run);
    }
  };

  /** Waits for the lookups started so far; for tests and shutdown. */
  async settled(): Promise<void> {
    while (this.running.size) await Promise.all([...this.running]);
  }

  private async write(activityId: string, p: ParticipantRec, unitId: string, key: string): Promise<void> {
    try {
      const found = await this.directory.lookup(p.personRef, unitId);
      if (!found) return;
      const next = { mobile: found.member.mobilephone ?? null, email: found.member.email ?? null };
      const contact = next.mobile || next.email ? next : null;
      // Written even when the tags are the same, to record the unit they're for.
      await this.hub().pushAsSystem(activityId, SYSTEM_VIEWER, [{ name: 'setMemberInfo', args: { participantId: p.id, memberTags: found.tags, unitId, contact } }]);
    } catch (err) {
      this.done.delete(key); // try again on the next commit
      console.error(`sync: could not look up ${p.personRef} for ${activityId}`, err);
    }
  }
}
