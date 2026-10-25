import { describe, expect, it } from 'vitest';
import { MapView, OverlayTx, mutationCtx, recKey, type Rec } from '@sync/core';
import { activityPhase, getActivity, latestEntry, activityProjector, activityRegistry, statusCounts } from '@sync/domain';
import { MANAGER, EXTERNAL, HOUR, T0, addMember, respondMember, startedActivity } from './helpers';

describe('latestEntry', () => {
  const entry = (id: string, at: number, version: number) => ({ id, at, version });

  it('orders by at, then version, then id; unconfirmed entries count as newest at the same at', () => {
    expect(latestEntry([entry('a', 2, 5), entry('b', 1, 9)])?.id).toBe('a');
    expect(latestEntry([entry('a', 2, 5), entry('b', 2, 4)])?.id).toBe('a');
    expect(latestEntry([entry('a', 2, 5), entry('b', 2, 0)])?.id).toBe('b');
    expect(latestEntry([entry('a', 2, 5), entry('b', 2, 5)])?.id).toBe('b');
  });

  it('ignores entries after asOf', () => {
    expect(latestEntry([entry('a', 1, 1), entry('b', 5, 2)], 3)?.id).toBe('a');
    expect(latestEntry([entry('b', 5, 2)], 3)).toBeUndefined();
  });
});

describe('event lifecycle', () => {
  it('moves from not started to open for sign-in to in progress to closed', () => {
    const e = startedActivity({ startTime: T0, earlySignInWindow: 4 * HOUR });
    const activity = getActivity(e.view)!;
    expect(activityPhase(activity, T0 - 5 * HOUR)).toBe('notStarted');
    expect(activityPhase(activity, T0 - 3 * HOUR)).toBe('openForSignIn');
    expect(activityPhase(activity, T0)).toBe('inProgress');
    expect(activityPhase({ ...activity, closed: true }, T0)).toBe('closed');
    expect(activityPhase({ ...activity, earlySignInWindow: null }, T0 - 100 * HOUR)).toBe('openForSignIn');
  });

  it('counts current statuses, optionally per unit', () => {
    const e = startedActivity();
    addMember(e, 'kcsara:1', 'staging');
    addMember(e, 'kcsara:2', 'standby');
    addMember(e, 'kcsara:3', 'standby', { id: 'org-rmr', title: 'RMR', rosterName: null });
    expect(statusCounts(e.view)).toMatchObject({ staging: 1, standby: 2, assigned: 0 });
    expect(statusCounts(e.view, 'org-rmr')).toMatchObject({ staging: 0, standby: 1 });
  });
});

describe('mutations are deterministic', () => {
  it('produce identical writes on client and server from the same state', () => {
    const e = startedActivity();
    addMember(e, 'kcsara:1');
    e.run('createTeam', { id: 't1', name: 'Team 1' });
    const def = activityRegistry.latest('disbandTeam')!;
    const args = def.args.parse({ teamId: 't1', reassignTo: null, at: T0 + 2 * HOUR });
    const writes = (side: 'client' | 'server') => {
      const tx = new OverlayTx(new MapView(e.records));
      def.run(tx, args, mutationCtx(MANAGER, 'c-1', 7, side));
      return [...tx.writes.values()];
    };
    expect(writes('client')).toEqual(writes('server'));
  });
});

describe('projection', () => {
  function sample() {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:1');
    e.run('setMiles', { participantId: pid, miles: 40 });
    e.run('createTeam', { id: 't1', name: 'Team 1' });
    e.run('updateTeam', { id: 't1', assignment: 'Segment 4', notes: 'Bring rope' });
    e.run('assign', { participantId: pid, target: { kind: 'team', id: 't1' }, at: T0 + 2 * HOUR });
    e.run('addComm', { id: 'c1', from: 'Base', to: 'Team 1', message: 'Go', at: T0 + 2 * HOUR });
    return { e, pid, records: [...e.records.values()] };
  }
  const projectAll = (key: string, records: Rec[]) => new Map(records.map((r) => [recKey(r), activityProjector.project(key, r)]));
  const keyFor = activityProjector.viewKey;

  it('keys views by tier and class', () => {
    expect([keyFor(MANAGER), keyFor(respondMember('kcsara:1')), keyFor(EXTERNAL), keyFor({ ...MANAGER, tier: 'manage' })]).toEqual(['manage', 'respond:member', 'respond:external', 'manage']);
  });

  it('shows managers everything', () => {
    const { records } = sample();
    for (const r of records) expect(activityProjector.project('manage', r)).toBe(r);
  });

  it('hides restricted records and fields from respond-tier members', () => {
    const { records, pid } = sample();
    const view = projectAll('respond:member', records);
    const participant = view.get(`participant/${pid}`)!;
    expect(participant).toMatchObject({ personRef: 'kcsara:1', firstname: '1' });
    expect(participant).toMatchObject({ miles: 40 });
    expect(view.get('team/t1')).toEqual({ type: 'team', id: 't1', version: expect.any(Number), name: 'Team 1' });
    expect(view.get('comm/c1')).toBeNull();
    const assignment = [...view.values()].find((r) => r?.type === 'assignment')!;
    expect(assignment.target).toEqual({ kind: 'team' });
    // The briefing is for everyone: respond-tier members see the description and map.
    expect(view.get('activity/activity')).toHaveProperty('description');
    expect(view.get('activity/activity')).toHaveProperty('mapId');
  });

  it('shows external people less than members', () => {
    const { records, pid } = sample();
    const view = projectAll('respond:external', records);
    expect(view.get(`participant/${pid}`)).not.toHaveProperty('personRef');
    expect([...view.values()].filter((r) => r?.type === 'assignment')).toEqual([]);
  });

  it('hides record types it has no rule for', () => {
    expect(activityProjector.project('respond:member', { type: 'somethingNew', id: 'x', version: 1, secret: 1 })).toBeNull();
  });
});
