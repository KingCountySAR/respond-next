import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { autorun, reaction } from 'mobx';
import { Rejection } from '@sync/core';
import { ManageActivity, createActivityModel, isManageActivity, type ManageParticipant, type RespondActivity, type RespondParticipant } from '@sync/model';
import { MANAGER, ACTIVITY_ID, CRT, EXTERNAL, HOUR, T0, activityArgs, respondMember, offlineClient, sampleActivity, testClock } from './helpers';

describe('reading', () => {
  it('reads like plain objects', async () => {
    const { activity, anna } = await sampleActivity();
    expect(activity.phase).toBe('inProgress');
    expect(activity.participants.map((p) => [p.name, p.status])).toEqual([
      ['Anna Lee', 'staging'],
      ['Ben Okafor', 'staging'],
    ]);
    activity.participant(anna)!.assign({ kind: 'team', id: 't1' }, { asLeader: true, at: T0 + 2 * HOUR });
    const team = activity.team('t1')!;
    expect(team.members.map((p) => p.name)).toEqual(['Anna Lee']);
    expect(team.leader).toBe(activity.participant(anna));
    expect(activity.participants[0]!.status).toBe('assigned');
    expect(activity.participants[0]!.locationName).toBe('Team 1');
    expect(activity.participants[0]!.team).toBe(team);
    expect(activity.statusCounts).toMatchObject({ assigned: 1, staging: 1 });
  });

  it('offers the next statuses the domain allows', async () => {
    const { activity, anna } = await sampleActivity();
    expect(activity.participant(anna)!.nextStatuses).toEqual(['demobilizing', 'assigned']);
    activity.update({ mode: 'light' });
    expect(activity.participant(anna)!.nextStatuses).toEqual(['demobilizing']);
  });

  it('reads tags, time on the clock, unit counts and unit-aware steps', async () => {
    const { activity, anna, setTime } = await sampleActivity();
    const a = activity.participant(anna)!;
    activity.mutate('setActivityTags', { participantId: anna, tags: ['Medic'] });
    expect(a.tags).toEqual(['Medic']);
    setTime(T0 + 3 * HOUR);
    expect(a.timeOnClock).toBe(2 * HOUR); // staging since T0 + 1h
    expect(a.isEnrouteOrStandby).toBe(false);
    expect(activity.unit(CRT.id)!.activeParticipantCount).toBe(2);
    expect(a.statusStepsUnder(CRT.id).map((s) => s.status)).toEqual(['demobilizing', 'assigned']);
    expect(a.statusStepsUnder('org-other')).toEqual([
      { status: 'responding', switchingFrom: CRT.id },
      { status: 'clear', switchingFrom: CRT.id },
    ]);
  });

  it('marks unconfirmed changes', async () => {
    const { activity } = await sampleActivity();
    expect(activity.participants[0]!.isPending).toBe(true); // offline: nothing is confirmed
  });
});

describe('reactivity', () => {
  it("re-runs a reader only when what it read changes", async () => {
    const { activity, anna, ben } = await sampleActivity();
    const a = activity.participant(anna)!;
    let runs = 0;
    const stop = autorun(() => {
      void a.status, a.locationName, a.name;
      runs++;
    });
    activity.participant(ben)!.setStatus('clear', { at: T0 + 2 * HOUR });
    activity.participant(ben)!.assign({ kind: 'team', id: 't1' }, { at: T0 + 2 * HOUR });
    expect(runs).toBe(1);
    a.setStatus('demobilizing', { at: T0 + 3 * HOUR });
    expect(runs).toBe(2);
    stop();
  });

  it('keeps list identity when no one is added, removed or reordered', async () => {
    const { client, activity, anna } = await sampleActivity();
    const lists: unknown[] = [];
    const stop = autorun(() => lists.push(activity.participants));
    client.mutate(ACTIVITY_ID, 'setEta', { participantId: anna, eta: T0 + 3 * HOUR });
    expect(lists).toHaveLength(1);
    client.mutate(ACTIVITY_ID, 'addParticipant', { personRef: 'kcsara:3', firstname: 'Cy', lastname: 'Adams', unit: { id: 'org-crt', title: 'Cascade Rescue Team', rosterName: 'CRT' }, status: 'standby' });
    expect(lists).toHaveLength(2);
    stop();
  });

  it('keeps the same model object for the same person', async () => {
    const { activity, anna } = await sampleActivity();
    expect(activity.participant(anna)).toBe(activity.participants[0]);
  });
});

describe('time', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('moves the phase on as the clock ticks, and stops ticking when nothing watches', async () => {
    const client = await offlineClient();
    client.mutate(ACTIVITY_ID, 'createActivity', activityArgs({ startTime: T0, earlySignInWindow: HOUR }));
    const { clock, set } = testClock(T0 - 2 * HOUR);
    const activity = new ManageActivity(client, ACTIVITY_ID, { clock });

    const phases: unknown[] = [];
    const stop = reaction(() => activity.phase, (p) => phases.push(p), { fireImmediately: true });
    set(T0 - 30 * 60 * 1000);
    vi.advanceTimersByTime(1000);
    set(T0 + 1);
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(5000); // ticks with no change don't fire
    expect(phases).toEqual(['notStarted', 'openForSignIn', 'inProgress']);

    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('writing', () => {
  it('applies at once and throws what the domain refuses', async () => {
    const { activity, anna } = await sampleActivity();
    activity.participant(anna)!.setStatus('demobilizing', { at: T0 + 3 * HOUR });
    expect(activity.participant(anna)!.status).toBe('demobilizing');
    expect(() => activity.team('t1')!.setStatus('onScene', { at: T0 + 3 * HOUR })).not.toThrow();
    expect(activity.team('t1')!.status).toBe('onScene');
  });

  it('gives respond viewers only self-service actions', async () => {
    const { activity, anna } = await sampleActivity();
    const respond: RespondActivity = activity;
    // @ts-expect-error assigning is manager-only, so a respond participant has no assign()
    respond.participant(anna)!.assign;
    expect(typeof activity.participant(anna)!.assign).toBe('function');
  });

  it('enforces the viewer rules locally', async () => {
    const client = await offlineClient(respondMember('kcsara:9'));
    const activity = createActivityModel(client, ACTIVITY_ID);
    expect(() => activity.mutate('createTeam', { id: 't9', name: 'Mine' })).toThrow(Rejection);
  });
});

describe('the model for each viewer', () => {
  it('is ManageActivity for managers, RespondActivity for everyone else', async () => {
    const kinds = await Promise.all(
      [MANAGER, { ...MANAGER, tier: 'manage' as const }, respondMember('kcsara:9'), EXTERNAL].map(async (viewer) => {
        const model = createActivityModel(await offlineClient(viewer), ACTIVITY_ID);
        return [isManageActivity(model), model.viewKey, model.canSeeAssignments];
      }),
    );
    expect(kinds).toEqual([
      [true, 'manage', true],
      [true, 'manage', true],
      [false, 'respond:member', true],
      [false, 'respond:external', false],
    ]);
  });

  it('types respond records from the projection: member-only fields optional, manager-only fields absent', async () => {
    const { activity, anna } = await sampleActivity();
    const respond: RespondActivity = activity;
    const rec = respond.participant(anna)!.record!;
    expectTypeOf(rec.firstname).toEqualTypeOf<string>();
    expectTypeOf(rec.personRef).toEqualTypeOf<string | undefined>(); // external people don't get it
    expectTypeOf(rec.miles).toEqualTypeOf<number | null>(); // responders see mileage
    // @ts-expect-error a team's notes are manager-only
    respond.team('t1')!.record!.notes;
    expectTypeOf(activity.team('t1')!.record!.notes).toEqualTypeOf<string | null>();
    expectTypeOf(activity.participants).toEqualTypeOf<ManageParticipant[]>();
    expectTypeOf(respond.participants).toEqualTypeOf<RespondParticipant[]>();
    expectTypeOf(activity.team('t1')!.members).toEqualTypeOf<ManageParticipant[]>();
  });
});
