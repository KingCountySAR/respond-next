import { describe, expect, it } from 'vitest';
import type { Rec } from '@sync/core';
import { SYSTEM_VIEWER, activityProjector, activityRegistry, participantIdFor, type ContactRec, type ParticipantRec } from '@sync/domain';
import { Hub, MemoryStorage } from '@sync/server';
import { MemberInfoWriter, type PersonLookup } from '../src/memberInfo';
import { FixtureDirectory, fixtureMembers, tagsFor } from '../src/members';
import { CRT, activityArgs } from '../../packages/domain/__tests__/helpers';

const members = fixtureMembers('kcsara', [
  ['Bo', 'Okafor', 'Field', 'Medical'],
  ['Kai', 'Lindqvist', 'Field'],
]);

/** The fixture, with CRT's tag for its Medical group, as the member providers give it. */
function tagged(fixture = new FixtureDirectory({ CRT: members })): PersonLookup {
  return { lookup: async (ref) => fixture.lookup(ref).then((f) => f && { member: f.member, tags: tagsFor(f.member.groups, { Medical: 'MED' }) }) };
}

function setup(directory: PersonLookup = tagged()) {
  let writer: MemberInfoWriter;
  const hub: Hub = new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: Date.now, onCommit: (id, view) => writer.onCommit(id, view) });
  writer = new MemberInfoWriter(() => hub, directory);
  const push = (name: string, args: Record<string, unknown>) => hub.pushAsSystem('a1', SYSTEM_VIEWER, [{ name, args: { at: Date.now(), ...args } }]);
  const records = async <T extends Rec>(type: string) => (await hub.actor('a1')).projectedRecords('command').filter((r) => r.type === type) as T[];
  return { hub, writer, push, records };
}

const addParticipant = (personRef: string, firstname: string, lastname: string) => ({ personRef, firstname, lastname, unit: CRT, status: 'responding' });

describe('member info', () => {
  it("writes a member's tags and contact once they're on an activity", async () => {
    const { writer, push, records } = setup();
    await push('createActivity', activityArgs({ startTime: Date.now() }));
    await push('addParticipant', addParticipant('kcsara:1', 'Bo', 'Okafor'));
    await push('addParticipant', addParticipant('adhoc:x1', 'Pat', 'Visitor'));
    await writer.settled();

    const bo = (await records<ParticipantRec>('participant')).find((p) => p.personRef === 'kcsara:1')!;
    expect(bo.memberTags).toEqual(['MED']);
    expect(await records<ContactRec>('contact')).toEqual([expect.objectContaining({ id: bo.id, email: 'bo.okafor@example.org', mobile: null })]);
    // Someone the directory doesn't know is left alone.
    expect((await records<ParticipantRec>('participant')).find((p) => p.personRef === 'adhoc:x1')?.memberTags).toEqual([]);
  });

  it("doesn't write when nothing changed, and looks each person up once", async () => {
    let lookups = 0;
    const fixture = tagged();
    const counting: PersonLookup = { lookup: (ref) => (lookups++, fixture.lookup(ref)) };
    const { hub, writer, push } = setup(counting);
    await push('createActivity', activityArgs({ startTime: Date.now() }));
    await push('addParticipant', addParticipant('kcsara:2', 'Kai', 'Lindqvist'));
    await writer.settled();
    const version = (await hub.actor('a1')).currentVersion;
    await push('setEta', { participantId: participantIdFor('kcsara:2'), eta: Date.now() + 3600_000 });
    await writer.settled();
    expect(lookups).toBe(1);
    // The contact was written once; the ETA is the only change since.
    expect((await hub.actor('a1')).currentVersion).toBe(version + 1);
  });

  it('tries again on the next commit when a lookup fails', async () => {
    let fail = true;
    const fixture = tagged();
    const flaky: PersonLookup = { lookup: async (ref) => (fail ? Promise.reject(new Error('cedar down')) : fixture.lookup(ref)) };
    const { writer, push, records } = setup(flaky);
    const error = console.error;
    console.error = () => {};
    try {
      await push('createActivity', activityArgs({ startTime: Date.now() }));
      await push('addParticipant', addParticipant('kcsara:1', 'Bo', 'Okafor'));
      await writer.settled();
      fail = false;
      await push('setEta', { participantId: participantIdFor('kcsara:1'), eta: null });
      await writer.settled();
    } finally {
      console.error = error;
    }
    expect((await records<ParticipantRec>('participant'))[0]?.memberTags).toEqual(['MED']);
  });
});
