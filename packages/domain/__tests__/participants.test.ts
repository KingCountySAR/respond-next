import { describe, expect, it } from 'vitest';
import { participantIdFor, participantTimeline, statusOf, statusSteps, currentUnitOf, getEvent, type ParticipantRec } from '@sync/domain';
import { COMMAND, CRT, EXTERNAL, HOUR, RMR, SYSTEM, T0, addMember, fieldMember, startedEvent } from './helpers';

const timeline = (e: ReturnType<typeof startedEvent>, pid: string) => participantTimeline(e.view, pid).map((s) => `${s.status}@${s.unitId}`);

describe('adding participants', () => {
  it('creates the participant, their unit and their first status', () => {
    const e = startedEvent();
    const pid = addMember(e, 'kcsara:85205', 'responding');
    expect(pid).toBe(participantIdFor('kcsara:85205'));
    expect(e.get('eventUnit', CRT.id)).toMatchObject({ title: CRT.title, rosterName: 'CRT' });
    expect(statusOf(e.view, pid)).toBe('responding');
    expect(currentUnitOf(e.view, pid)).toBe(CRT.id);
  });

  it('reuses the existing participant when the same person is added again', () => {
    const e = startedEvent();
    const pid = addMember(e, 'kcsara:85205', 'responding');
    addMember(e, 'kcsara:85205', 'staging', CRT, T0 + 2 * HOUR);
    expect(e.all('participant')).toHaveLength(1);
    expect(timeline(e, pid)).toEqual([`staging@${CRT.id}`, `responding@${CRT.id}`]);
  });

  it('records nothing when the status and unit are unchanged', () => {
    const e = startedEvent();
    const pid = addMember(e, 'kcsara:1', 'responding');
    e.run('setParticipantStatus', { participantId: pid, status: 'responding', unit: CRT, at: T0 + 2 * HOUR });
    expect(timeline(e, pid)).toHaveLength(1);
  });

  it('lets field members sign only themselves in', () => {
    const e = startedEvent();
    const args = { personRef: 'kcsara:2', firstname: 'Anna', lastname: 'B', unit: CRT, status: 'responding', at: T0 + HOUR };
    expect(e.rejects('addParticipant', args, fieldMember('kcsara:9'))).toBe('forbidden');
    expect(e.rejects('addParticipant', args, fieldMember('kcsara:2'))).toBeUndefined();
  });
});

describe('changing units', () => {
  it('clears the participant under the old unit before the new status', () => {
    const e = startedEvent();
    const pid = addMember(e, 'kcsara:1', 'responding', CRT);
    e.run('setParticipantStatus', { participantId: pid, status: 'responding', unit: RMR, at: T0 + 2 * HOUR });
    expect(timeline(e, pid)).toEqual([`responding@${RMR.id}`, `clear@${CRT.id}`, `responding@${CRT.id}`]);
  });

  it('only clears the old unit when clearing under a new one', () => {
    const e = startedEvent();
    const pid = addMember(e, 'kcsara:1', 'responding', CRT);
    e.run('setParticipantStatus', { participantId: pid, status: 'clear', unit: RMR, at: T0 + 2 * HOUR });
    expect(timeline(e, pid)).toEqual([`clear@${CRT.id}`, `responding@${CRT.id}`]);
  });

  it("doesn't clear a unit the participant wasn't active in", () => {
    const e = startedEvent();
    const pid = addMember(e, 'kcsara:1', 'notResponding', CRT);
    e.run('setParticipantStatus', { participantId: pid, status: 'standby', unit: RMR, at: T0 + 2 * HOUR });
    expect(timeline(e, pid)).toEqual([`standby@${RMR.id}`, `notResponding@${CRT.id}`]);
  });
});

describe('standby-only and sign-in window', () => {
  it('allows only standby for field users before sign-in opens; command may do anything', () => {
    const e = startedEvent({ startTime: T0 + 10 * HOUR, earlySignInWindow: 4 * HOUR });
    const me = fieldMember('kcsara:3');
    const args = (status: string) => ({ personRef: 'kcsara:3', firstname: 'Fred', lastname: 'C', unit: CRT, status, at: T0 + HOUR });
    expect(e.rejects('addParticipant', args('responding'), me)).toBe('standby_only');
    expect(e.rejects('addParticipant', args('standby'), me)).toBeUndefined();
    expect(e.rejects('addParticipant', { ...args('responding'), personRef: 'kcsara:4' }, COMMAND)).toBeUndefined();
  });

  it('keeps standbyOnly events standby-only unless already responding', () => {
    const e = startedEvent({ standbyOnly: true });
    const me = fieldMember('kcsara:3');
    expect(e.rejects('addParticipant', { personRef: 'kcsara:3', firstname: 'Fred', lastname: 'C', unit: CRT, status: 'responding', at: T0 + HOUR }, me)).toBe('standby_only');
    const pid = addMember(e, 'kcsara:5', 'responding');
    expect(e.rejects('setParticipantStatus', { participantId: pid, status: 'staging', unit: CRT, at: T0 + 2 * HOUR }, fieldMember('kcsara:5'))).toBeUndefined();
  });

  it('offers the legacy status steps', () => {
    const event = getEvent(startedEvent().view)!;
    expect(statusSteps(event, 'unknown', T0)).toEqual(['responding', 'standby', 'remote']);
    expect(statusSteps(event, 'staging', T0)).toEqual(['demobilizing', 'assigned']);
    expect(statusSteps({ ...event, standbyOnly: true }, 'notResponding', T0)).toEqual(['standby']);
    expect(statusSteps({ ...event, mode: 'light' }, 'unknown', T0)).toEqual(['responding', 'standby']);
  });

  it('rejects remote and assigned in light mode, for everyone', () => {
    const e = startedEvent({ mode: 'light' });
    expect(e.rejects('addParticipant', { personRef: 'kcsara:1', firstname: 'A', lastname: 'B', unit: CRT, status: 'remote', at: T0 + HOUR })).toBe('light_mode');
  });
});

describe('participant details', () => {
  it('lets a field member set their own ETA, not someone else’s, and keeps miles command-or-self', () => {
    const e = startedEvent();
    const mine = addMember(e, 'kcsara:1');
    const theirs = addMember(e, 'kcsara:2');
    expect(e.rejects('setEta', { participantId: mine, eta: T0 + 3 * HOUR }, fieldMember('kcsara:1'))).toBeUndefined();
    expect(e.rejects('setEta', { participantId: theirs, eta: null }, fieldMember('kcsara:1'))).toBe('forbidden');
    expect(e.get<ParticipantRec>('participant', mine)?.eta).toBe(T0 + 3 * HOUR);
    expect(e.rejects('setMiles', { participantId: theirs, miles: 12 }, EXTERNAL)).toBe('forbidden');
  });

  it('writes member info only as the system', () => {
    const e = startedEvent();
    const pid = addMember(e, 'kcsara:1');
    const args = { participantId: pid, memberTags: ['EMT'], contact: { mobile: '206-555-0100', email: null } };
    expect(e.rejects('setMemberInfo', args, COMMAND)).toBe('forbidden');
    e.run('setMemberInfo', args, SYSTEM);
    expect(e.get<ParticipantRec>('participant', pid)?.memberTags).toEqual(['EMT']);
    expect(e.get('contact', pid)).toMatchObject({ participantId: pid, mobile: '206-555-0100' });
  });

  it("won't link two participants to the same person", () => {
    const e = startedEvent();
    addMember(e, 'kcsara:1');
    const adhoc = addMember(e, 'adhoc:abc');
    expect(e.rejects('linkPerson', { participantId: adhoc, personRef: 'kcsara:1' })).toBe('exists');
    expect(e.rejects('linkPerson', { participantId: adhoc, personRef: 'kcsara:7' })).toBeUndefined();
  });

  it('corrects a timeline entry in place (command only)', () => {
    const e = startedEvent();
    const pid = addMember(e, 'kcsara:1', 'responding');
    const entry = participantTimeline(e.view, pid)[0]!;
    expect(e.rejects('correctParticipantStatus', { entryId: entry.id, at: T0 }, fieldMember('kcsara:1'))).toBe('forbidden');
    e.run('correctParticipantStatus', { entryId: entry.id, at: T0, status: 'standby' });
    expect(participantTimeline(e.view, pid)[0]).toMatchObject({ id: entry.id, at: T0, status: 'standby' });
  });
});

describe('closing an event', () => {
  it('clears everyone still active, then rejects changes until reopened', () => {
    const e = startedEvent();
    const active = addMember(e, 'kcsara:1', 'assigned');
    const standby = addMember(e, 'kcsara:2', 'standby');
    const gone = addMember(e, 'kcsara:3', 'clear');
    e.run('closeEvent', { at: T0 + 5 * HOUR });
    expect([statusOf(e.view, active), statusOf(e.view, standby), statusOf(e.view, gone)]).toEqual(['clear', 'clear', 'clear']);
    expect(participantTimeline(e.view, gone)).toHaveLength(1);
    expect(getEvent(e.view)).toMatchObject({ closed: true, endTime: T0 + 5 * HOUR });

    expect(e.rejects('setEta', { participantId: active, eta: null })).toBe('closed');
    e.run('reopenEvent', {});
    expect(getEvent(e.view)).toMatchObject({ closed: false, endTime: null });
    expect(e.rejects('setEta', { participantId: active, eta: null })).toBeUndefined();
  });

  it('starts every event with the default places', () => {
    const e = startedEvent();
    expect(e.all<{ name: string } & ParticipantRec>('place').map((p) => p.name).sort()).toEqual(['Command Post', 'Field']);
    expect(e.rejects('createEvent', {})).toBe('bad_args');
  });
});
