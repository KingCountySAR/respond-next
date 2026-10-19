/**
 * Fills in what the member database knows about each person on an activity: their tags (their
 * organizations' labels for their groups) and their phone and email. After a commit, anyone not looked up yet (since this server
 * started) is looked up, and `setMemberInfo` is written when it differs from what the activity has.
 */
import type { ReadView } from '@sync/core';
import { ACTIVITY_LIST_ID, SYSTEM_VIEWER, type ContactRec, type ParticipantRec } from '@sync/domain';
import type { Hub } from '@sync/server';
import type { MemberDetails } from './members';

/** Where member info comes from: the member providers, by person ref. */
export interface PersonLookup {
  lookup(personRef: string): Promise<MemberDetails | undefined>;
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export class MemberInfoWriter {
  /** `<activity>/<participant>/<personRef>` once looked up (or being looked up). */
  private readonly done = new Set<string>();
  private readonly running = new Set<Promise<void>>();

  /** `hub` is a getter because the hub is built with `onCommit` from this writer. */
  constructor(
    private readonly hub: () => Hub,
    private readonly directory: PersonLookup,
  ) {}

  /** Pass to the hub's `onCommit`. */
  readonly onCommit = (activityId: string, view: ReadView): void => {
    if (activityId === ACTIVITY_LIST_ID) return;
    for (const p of view.scan<ParticipantRec>('participant')) {
      const key = `${activityId}/${p.id}/${p.personRef}`;
      if (this.done.has(key)) continue;
      this.done.add(key);
      const run = this.write(activityId, p, view.get<ContactRec>('contact', p.id), key).finally(() => this.running.delete(run));
      this.running.add(run);
    }
  };

  /** Waits for the lookups started so far; for tests and shutdown. */
  async settled(): Promise<void> {
    while (this.running.size) await Promise.all([...this.running]);
  }

  private async write(activityId: string, p: ParticipantRec, contact: ContactRec | undefined, key: string): Promise<void> {
    try {
      const found = await this.directory.lookup(p.personRef);
      if (!found) return;
      const next = { mobile: found.member.mobilephone ?? null, email: found.member.email ?? null };
      const nextContact = next.mobile || next.email ? next : null;
      const unchanged = sameList(p.memberTags, found.tags) && (nextContact ? contact?.mobile === next.mobile && contact?.email === next.email : !contact);
      if (unchanged) return;
      await this.hub().pushAsSystem(activityId, SYSTEM_VIEWER, [{ name: 'setMemberInfo', args: { participantId: p.id, memberTags: found.tags, contact: nextContact } }]);
    } catch (err) {
      this.done.delete(key); // try again on the next commit
      console.error(`sync: could not look up ${p.personRef} for ${activityId}`, err);
    }
  }
}
