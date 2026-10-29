import { describe, expect, expectTypeOf, it } from 'vitest';
import { autorun } from 'mobx';
import { DEFAULT_PLACES } from '@sync/domain';
import type { RespondActivity, RespondGroup, RespondPlace } from '@sync/model';
import { CRT, HOUR, T0, sampleActivity } from './helpers';

const AT = T0 + 2 * HOUR;

describe('teams, groups and places', () => {
  it('creates and arranges them', async () => {
    const { activity, anna, ben } = await sampleActivity();
    const team = activity.createTeam('Team 2');
    const group = activity.createGroup('Division A');
    team.moveToGroup(group, { at: AT });
    activity.participant(anna)!.assign(team.asTarget, { asLeader: true, at: AT });
    group.setLeader(activity.participant(ben)!);

    expect(team.group).toBe(group);
    expect(group.teams).toEqual([team]);
    expect(group.leader).toBe(activity.participant(ben));
    expect(team.leader).toBe(activity.participant(anna));
    expect(activity.teams.map((t) => t.name)).toEqual(['Team 1', 'Team 2']);

    team.update({ gar: 'amber', assignment: 'Search segment 4' });
    expect([team.gar, team.assignment]).toEqual(['amber', 'Search segment 4']);
  });

  it('moves people and equipment on when a team is disbanded', async () => {
    const { activity, anna } = await sampleActivity();
    const team = activity.team('t1')!;
    const base = activity.places.find((p) => p.isBase)!;
    activity.participant(anna)!.assign(team.asTarget, { at: AT });
    const litter = activity.addEquipment('inventory-11', team.asTarget);
    expect(team.members.map((p) => p.name)).toEqual(['Anna Lee']);
    expect(team.equipment).toEqual([litter]);

    team.disband(base.asTarget, { at: AT + 1 });
    expect(team.status).toBe('disbanded');
    expect(team.members).toEqual([]);
    expect(base.members.map((p) => p.name)).toEqual(['Anna Lee']);
    expect(base.equipment).toEqual([litter]);
    expect(litter.locationName).toBe(DEFAULT_PLACES.base);
  });

  it('keeps place details for managers', async () => {
    const { activity } = await sampleActivity();
    const lz = activity.createPlace({ name: 'LZ', lat: 47.5, lon: -121.8 });
    lz.update({ notes: 'Gravel lot' });
    expect([lz.name, lz.lat, lz.lon, lz.notes, lz.isBase]).toEqual(['LZ', 47.5, -121.8, 'Gravel lot', false]);
    expect(activity.places.map((p) => p.name)).toEqual(['Command Post', 'Field', 'LZ']);
  });
});

describe('units', () => {
  it('reads status and per-unit counts', async () => {
    const { activity, anna } = await sampleActivity();
    const crt = activity.unit(CRT.id)!;
    // Its first responder brought it on as responding.
    expect([crt.name, crt.title, crt.status]).toEqual(['CRT', 'Cascade Rescue Team', 'responding']);
    crt.setStatus('stoodDown', { at: AT });
    expect(crt.status).toBe('stoodDown');
    expect(crt.statusCounts).toMatchObject({ staging: 0, clear: 2 });
    expect(activity.participant(anna)!.unit).toBe(crt);
  });

  it('adds a unit the first time its status is set', async () => {
    const { activity } = await sampleActivity();
    activity.setUnitStatus({ id: 'org-sm', title: 'Ridgeline Mountain Rescue', rosterName: 'RMR' }, 'invited', { at: AT });
    expect(activity.units.map((u) => [u.name, u.status])).toEqual([
      ['CRT', 'responding'],
      ['RMR', 'invited'],
    ]);
  });
});

describe('comms', () => {
  it('keeps the log oldest first and drops deleted entries', async () => {
    const { activity } = await sampleActivity();
    const second = activity.logComm({ from: 'Team 1', to: 'Base', message: 'On scene', at: AT + 10 });
    const first = activity.logComm({ from: 'Base', to: 'Team 1', message: 'Proceed', at: AT });
    expect(activity.comms).toEqual([first, second]);
    expect(first.isPending).toBe(true);

    second.setFavorite(true);
    first.delete();
    expect(activity.comms).toEqual([second]);
    expect(second.favorite).toBe(true);
  });

  it('wakes only the entry that changed', async () => {
    const { activity } = await sampleActivity();
    const a = activity.logComm({ from: 'Base', to: 'Team 1', message: 'Proceed', at: AT });
    const b = activity.logComm({ from: 'Team 1', to: 'Base', message: 'On scene', at: AT + 10 });
    const runs = { list: 0, a: 0 };
    const stops = [
      autorun(() => {
        void activity.comms;
        runs.list++;
      }),
      autorun(() => {
        void a.message;
        runs.a++;
      }),
    ];
    b.edit({ message: 'On scene, starting search' });
    expect(runs).toEqual({ list: 1, a: 1 });
    stops.forEach((stop) => stop());
  });
});

describe('respond viewers', () => {
  it('get no comms, team details or operations actions', async () => {
    const { activity } = await sampleActivity();
    const respond: RespondActivity = activity;
    // @ts-expect-error comms are manager-only
    respond.comms;
    // @ts-expect-error team members are manager-only
    respond.teams[0]?.members;
    // @ts-expect-error moving equipment is manager-only
    respond.equipment[0]?.assign;
    expectTypeOf<NonNullable<RespondGroup['record']>['leaderParticipantId']>().toEqualTypeOf<string | null | undefined>(); // members only
    expectTypeOf<NonNullable<RespondPlace['record']>>().not.toHaveProperty('notes');
  });
});
