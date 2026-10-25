import { describe, expect, it } from 'vitest';
import { activityProjector, activitySummary, participantIdFor } from '@sync/domain';
import { CRT, HOUR, RMR, SYSTEM, T0, TestActivity, addMember, respondMember, startedActivity } from './helpers';

describe('activity summaries', () => {
  it('carry the activity, its units with active counts, and everyone with a status', () => {
    const e = startedActivity();
    addMember(e, 'kcsara:1', 'staging');
    addMember(e, 'kcsara:2', 'standby', RMR);
    const p3 = addMember(e, 'kcsara:3', 'responding');
    e.run('setParticipantStatus', { participantId: p3, status: 'clear', unit: CRT, at: T0 + 2 * HOUR });

    const s = activitySummary(e.view, 'a1')!;
    expect(s.activity).toMatchObject({ title: 'Lost hiker, Mailbox Peak', kind: 'mission', closed: false, startTime: T0 });
    expect(s.units).toEqual([
      { id: CRT.id, title: CRT.title, rosterName: 'CRT', status: 'responding', activeCount: 1 },
      { id: RMR.id, title: RMR.title, rosterName: 'RMR', status: 'standby', activeCount: 1 },
    ]);
    expect(s.people[participantIdFor('kcsara:1')]).toEqual({ status: 'staging', unitId: CRT.id });
    expect(s.people[p3]).toEqual({ status: 'clear', unitId: CRT.id });
    expect(JSON.stringify(s)).not.toContain('kcsara:'); // no person refs
  });

  it('is null before the activity exists and once it is removed', () => {
    const e = new TestActivity();
    expect(activitySummary(e.view, 'a1')).toBeNull();
    e.run('createActivity', { idNumber: '', kind: 'training', title: 'Rope day', description: '', location: { title: 'Camp', lat: null, lon: null, address: null }, mapId: '', startTime: T0, ownerOrgId: CRT.id, mode: 'full', standbyOnly: false });
    expect(activitySummary(e.view, 'a1')).not.toBeNull();
    e.run('removeActivity', { at: T0 + HOUR });
    expect(activitySummary(e.view, 'a1')).toBeNull();
  });

  it('is written only by the server, and every view sees it', () => {
    const list = new TestActivity();
    const summary = activitySummary(startedActivity().view, 'a1')!;
    expect(list.rejects('setActivitySummary', { id: 'a1', summary }, respondMember('kcsara:1'))).toBe('forbidden');
    list.run('setActivitySummary', { id: 'a1', summary }, SYSTEM);
    const rec = list.get('activitySummary', 'a1')!;
    expect(activityProjector.project('respond:external', rec)).toEqual(rec);
    list.run('setActivitySummary', { id: 'a1', summary: null }, SYSTEM);
    expect(list.get('activitySummary', 'a1')).toBeUndefined();
  });
});
