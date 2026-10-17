import { describe, expect, it } from 'vitest';
import { currentUnitOf, currentUnitStatus, getActivity, participantIdFor, participantTimeline, statusOf, statusSteps, statusStepsUnder, timeOnClock, type ParticipantRec } from '@sync/domain';
import { COMMAND, CRT, EXTERNAL, HOUR, RMR, SYSTEM, T0, addMember, fieldMember, startedActivity } from './helpers';

const timeline = (e: ReturnType<typeof startedActivity>, pid: string) => participantTimeline(e.view, pid).map((s) => `${s.status}@${s.unitId}`);

describe('adding participants', () => {
  it('creates the participant, their unit and their first status', () => {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:85205', 'responding');
    expect(pid).toBe(participantIdFor('kcsara:85205'));
    expect(e.get('activityUnit', CRT.id)).toMatchObject({ title: CRT.title, rosterName: 'CRT' });
    expect(statusOf(e.view, pid)).toBe('responding');
    expect(currentUnitOf(e.view, pid)).toBe(CRT.id);
  });

  it('reuses the existing participant when the same person is added again', () => {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:85205', 'responding');
    addMember(e, 'kcsara:85205', 'staging', CRT, T0 + 2 * HOUR);
    expect(e.all('participant')).toHaveLength(1);
    expect(timeline(e, pid)).toEqual([`staging@${CRT.id}`, `responding@${CRT.id}`]);
  });

  it('records nothing when the status and unit are unchanged', () => {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:1', 'responding');
    e.run('setParticipantStatus', { participantId: pid, status: 'responding', unit: CRT, at: T0 + 2 * HOUR });
    expect(timeline(e, pid)).toHaveLength(1);
  });

  it('lets field members sign only themselves in', () => {
    const e = startedActivity();
    const args = { personRef: 'kcsara:2', firstname: 'Anna', lastname: 'B', unit: CRT, status: 'responding', at: T0 + HOUR };
    expect(e.rejects('addParticipant', args, fieldMember('kcsara:9'))).toBe('forbidden');
    expect(e.rejects('addParticipant', args, fieldMember('kcsara:2'))).toBeUndefined();
  });
});

describe('changing units', () => {
  it('clears the participant under the old unit before the new status', () => {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:1', 'responding', CRT);
    e.run('setParticipantStatus', { participantId: pid, status: 'responding', unit: RMR, at: T0 + 2 * HOUR });
    expect(timeline(e, pid)).toEqual([`responding@${RMR.id}`, `clear@${CRT.id}`, `responding@${CRT.id}`]);
  });

  it('only clears the old unit when clearing under a new one', () => {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:1', 'responding', CRT);
    e.run('setParticipantStatus', { participantId: pid, status: 'clear', unit: RMR, at: T0 + 2 * HOUR });
    expect(timeline(e, pid)).toEqual([`clear@${CRT.id}`, `responding@${CRT.id}`]);
  });

  it("doesn't clear a unit the participant wasn't active in", () => {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:1', 'notResponding', CRT);
    e.run('setParticipantStatus', { participantId: pid, status: 'standby', unit: RMR, at: T0 + 2 * HOUR });
    expect(timeline(e, pid)).toEqual([`standby@${RMR.id}`, `notResponding@${CRT.id}`]);
  });
});

describe('standby-only and sign-in window', () => {
  it('allows only standby for field users before sign-in opens; command may do anything', () => {
    const e = startedActivity({ startTime: T0 + 10 * HOUR, earlySignInWindow: 4 * HOUR });
    const me = fieldMember('kcsara:3');
    const args = (status: string) => ({ personRef: 'kcsara:3', firstname: 'Fred', lastname: 'C', unit: CRT, status, at: T0 + HOUR });
    expect(e.rejects('addParticipant', args('responding'), me)).toBe('standby_only');
    expect(e.rejects('addParticipant', args('standby'), me)).toBeUndefined();
    expect(e.rejects('addParticipant', { ...args('responding'), personRef: 'kcsara:4' }, COMMAND)).toBeUndefined();
  });

  it('keeps standbyOnly events standby-only unless already responding', () => {
    const e = startedActivity({ standbyOnly: true });
    const me = fieldMember('kcsara:3');
    expect(e.rejects('addParticipant', { personRef: 'kcsara:3', firstname: 'Fred', lastname: 'C', unit: CRT, status: 'responding', at: T0 + HOUR }, me)).toBe('standby_only');
    const pid = addMember(e, 'kcsara:5', 'responding');
    expect(e.rejects('setParticipantStatus', { participantId: pid, status: 'staging', unit: CRT, at: T0 + 2 * HOUR }, fieldMember('kcsara:5'))).toBeUndefined();
  });

  it('offers the legacy status steps', () => {
    const activity = getActivity(startedActivity().view)!;
    expect(statusSteps(activity, 'unknown', T0)).toEqual(['responding', 'standby', 'remote']);
    expect(statusSteps(activity, 'staging', T0)).toEqual(['demobilizing', 'assigned']);
    expect(statusSteps({ ...activity, standbyOnly: true }, 'notResponding', T0)).toEqual(['standby']);
    expect(statusSteps({ ...activity, mode: 'light' }, 'unknown', T0)).toEqual(['responding', 'standby']);
  });

  it('rejects remote and assigned in light mode, for everyone', () => {
    const e = startedActivity({ mode: 'light' });
    expect(e.rejects('addParticipant', { personRef: 'kcsara:1', firstname: 'A', lastname: 'B', unit: CRT, status: 'remote', at: T0 + HOUR })).toBe('light_mode');
  });
});

describe('participant details', () => {
  it('lets a field member set their own ETA, not someone else’s, and keeps miles command-or-self', () => {
    const e = startedActivity();
    const mine = addMember(e, 'kcsara:1');
    const theirs = addMember(e, 'kcsara:2');
    expect(e.rejects('setEta', { participantId: mine, eta: T0 + 3 * HOUR }, fieldMember('kcsara:1'))).toBeUndefined();
    expect(e.rejects('setEta', { participantId: theirs, eta: null }, fieldMember('kcsara:1'))).toBe('forbidden');
    expect(e.get<ParticipantRec>('participant', mine)?.eta).toBe(T0 + 3 * HOUR);
    expect(e.rejects('setMiles', { participantId: theirs, miles: 12 }, EXTERNAL)).toBe('forbidden');
  });

  it('writes member info only as the system', () => {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:1');
    const args = { participantId: pid, memberTags: ['EMT'], contact: { mobile: '206-555-0100', email: null } };
    expect(e.rejects('setMemberInfo', args, COMMAND)).toBe('forbidden');
    e.run('setMemberInfo', args, SYSTEM);
    expect(e.get<ParticipantRec>('participant', pid)?.memberTags).toEqual(['EMT']);
    expect(e.get('contact', pid)).toMatchObject({ participantId: pid, mobile: '206-555-0100' });
  });

  it("won't link two participants to the same person", () => {
    const e = startedActivity();
    addMember(e, 'kcsara:1');
    const adhoc = addMember(e, 'adhoc:abc');
    expect(e.rejects('linkPerson', { participantId: adhoc, personRef: 'kcsara:1' })).toBe('exists');
    expect(e.rejects('linkPerson', { participantId: adhoc, personRef: 'kcsara:7' })).toBeUndefined();
  });

  it('corrects a timeline entry in place (command only)', () => {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:1', 'responding');
    const entry = participantTimeline(e.view, pid)[0]!;
    expect(e.rejects('correctParticipantStatus', { entryId: entry.id, at: T0 }, fieldMember('kcsara:1'))).toBe('forbidden');
    e.run('correctParticipantStatus', { entryId: entry.id, at: T0, status: 'standby' });
    expect(participantTimeline(e.view, pid)[0]).toMatchObject({ id: entry.id, at: T0, status: 'standby' });
  });
});

describe('closing an event', () => {
  it('clears everyone still active, then rejects changes until reopened', () => {
    const e = startedActivity();
    const active = addMember(e, 'kcsara:1', 'assigned');
    const standby = addMember(e, 'kcsara:2', 'standby');
    const gone = addMember(e, 'kcsara:3', 'clear');
    e.run('closeActivity', { at: T0 + 5 * HOUR });
    expect([statusOf(e.view, active), statusOf(e.view, standby), statusOf(e.view, gone)]).toEqual(['clear', 'clear', 'clear']);
    expect(participantTimeline(e.view, gone)).toHaveLength(1);
    expect(getActivity(e.view)).toMatchObject({ closed: true, endTime: T0 + 5 * HOUR });

    expect(e.rejects('setEta', { participantId: active, eta: null })).toBe('closed');
    e.run('reopenActivity', {});
    expect(getActivity(e.view)).toMatchObject({ closed: false, endTime: null });
    expect(e.rejects('setEta', { participantId: active, eta: null })).toBeUndefined();
  });

  it('starts every event with the default places', () => {
    const e = startedActivity();
    expect(e.all<{ name: string } & ParticipantRec>('place').map((p) => p.name).sort()).toEqual(['Command Post', 'Field']);
    expect(e.rejects('createActivity', {})).toBe('bad_args');
  });
});

describe("a unit's first responder", () => {
  it('brings the unit on as standby or responding, and later responders leave it alone', () => {
    const e = startedActivity();
    addMember(e, 'kcsara:1', 'standby');
    expect(currentUnitStatus(e.view, CRT.id)?.status).toBe('standby');
    addMember(e, 'kcsara:2', 'responding', CRT, T0 + 2 * HOUR);
    expect(currentUnitStatus(e.view, CRT.id)?.status).toBe('standby');
    addMember(e, 'kcsara:3', 'responding', RMR);
    expect(currentUnitStatus(e.view, RMR.id)?.status).toBe('responding');
  });
});

describe('status steps under a unit', () => {
  const activity = { startTime: T0, earlySignInWindow: null, standbyOnly: false, mode: 'full' as const };

  it('are the normal steps under your own unit', () => {
    expect(statusStepsUnder(activity, { status: 'responding', unitId: CRT.id }, CRT.id, T0)).toEqual([{ status: 'staging' }, { status: 'demobilizing' }, { status: 'clear' }]);
    expect(statusStepsUnder(activity, undefined, CRT.id, T0).map((s) => s.status)).toEqual(['responding', 'standby', 'remote']);
  });

  it('offer switching units or signing out of the other one while active under it', () => {
    expect(statusStepsUnder(activity, { status: 'staging', unitId: RMR.id }, CRT.id, T0)).toEqual([
      { status: 'responding', switchingFrom: RMR.id },
      { status: 'clear', switchingFrom: RMR.id },
    ]);
    expect(statusStepsUnder(activity, { status: 'standby', unitId: RMR.id }, CRT.id, T0)[0]).toEqual({ status: 'standby', switchingFrom: RMR.id });
    expect(statusStepsUnder(activity, { status: 'clear', unitId: RMR.id }, CRT.id, T0)[0]).toEqual({ status: 'responding' });
  });

  it('switching moves the person to your unit and clears them under the other', () => {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:1', 'staging', RMR);
    e.run('setParticipantStatus', { participantId: pid, status: 'responding', unit: CRT, at: T0 + 2 * HOUR });
    expect(timeline(e, pid)).toEqual([`responding@${CRT.id}`, `clear@${RMR.id}`, `staging@${RMR.id}`]);
  });
});

describe('time on the clock', () => {
  it('counts responding through demobilizing, not standby, and runs on for the current entry', () => {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:1', 'standby', CRT, T0);
    e.run('setParticipantStatus', { participantId: pid, status: 'responding', unit: CRT, at: T0 + HOUR });
    e.run('setParticipantStatus', { participantId: pid, status: 'clear', unit: CRT, at: T0 + 3 * HOUR });
    expect(timeOnClock(e.view, pid, T0 + 10 * HOUR)).toBe(2 * HOUR);
    e.run('setParticipantStatus', { participantId: pid, status: 'responding', unit: CRT, at: T0 + 4 * HOUR });
    expect(timeOnClock(e.view, pid, T0 + 5 * HOUR)).toBe(3 * HOUR);
  });
});
