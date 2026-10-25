import { describe, expect, it } from 'vitest';
import { keyOf } from '@sync/core';
import { Level, commLevel, currentTarget, groupTeams, statusOf, teamMembers, teamNameConflict, teamStatusOf, type CommRec, type EquipmentRec, type GroupRec, type PlaceRec, type TeamRec } from '@sync/domain';
import { HOUR, T0, addMember, fieldMember, startedActivity, type TestActivity } from './helpers';

const placeId = (e: TestActivity, name: string) => e.all<PlaceRec>('place').find((p) => p.name === name)!.id;
const team = (id: string) => ({ kind: 'team', id }) as const;

function withTeam(e: TestActivity, id = 't1', name = 'Team 1') {
  e.run('createTeam', { id, name });
  return id;
}

describe('assigning participants', () => {
  it('flips staging to assigned and back, leaving other statuses alone', () => {
    const e = startedActivity();
    const t = withTeam(e);
    const staging = addMember(e, 'kcsara:1', 'staging');
    const enRoute = addMember(e, 'kcsara:2', 'responding');
    e.run('assign', { participantId: staging, target: team(t), at: T0 + 2 * HOUR });
    e.run('assign', { participantId: enRoute, target: team(t), at: T0 + 2 * HOUR });
    expect([statusOf(e.view, staging), statusOf(e.view, enRoute)]).toEqual(['assigned', 'responding']);
    expect(teamMembers(e.view, t).map((p) => p.id).sort()).toEqual([staging, enRoute].sort());

    e.run('assign', { participantId: staging, target: null, at: T0 + 3 * HOUR });
    expect(statusOf(e.view, staging)).toBe('staging');
  });

  it('applies follow-on status changes at the backdated time', () => {
    const e = startedActivity();
    const t = withTeam(e);
    const pid = addMember(e, 'kcsara:1', 'staging', undefined, T0 + HOUR);
    e.run('assign', { participantId: pid, target: team(t), at: T0 + 2 * HOUR });
    expect(statusOf(e.view, pid, T0 + 2 * HOUR - 1)).toBe('staging');
    expect(statusOf(e.view, pid, T0 + 2 * HOUR)).toBe('assigned');
    // Members as of a time only count entries at or before it.
    expect(teamMembers(e.view, t, T0 + HOUR)).toEqual([]);
  });

  it('hands the lead to the one picked, else a member left, when the leader moves elsewhere', () => {
    const e = startedActivity();
    const t = withTeam(e);
    const t2 = withTeam(e, 't2', 'Team 2');
    const [pid, ana, ben, cal] = ['kcsara:1', 'kcsara:2', 'kcsara:3', 'kcsara:4'].map((ref) => addMember(e, ref));
    e.run('assign', { participantId: pid!, target: team(t), asLeader: true, at: T0 + 2 * HOUR });
    for (const p of [ana, ben, cal]) e.run('assign', { participantId: p!, target: team(t), at: T0 + 2 * HOUR });
    const leader = () => e.get<TeamRec>('team', t)?.leaderParticipantId;
    expect(leader()).toBe(pid);

    // Three stay: the one picked leads, and someone not staying can't be picked.
    expect(e.rejects('assign', { participantId: pid!, target: team(t2), newLeaderId: pid!, at: T0 + 3 * HOUR })).toBe('not_member');
    e.run('assign', { participantId: pid!, target: team(t2), newLeaderId: cal!, at: T0 + 3 * HOUR });
    expect(leader()).toBe(cal);
    // Two stay and nobody's picked (an older client): the first member found leads.
    e.run('assign', { participantId: cal!, target: null, at: T0 + 3 * HOUR });
    expect([ana, ben]).toContain(leader());
    // One stays: they lead.
    e.run('setTeamLeader', { teamId: t, participantId: ana! });
    e.run('assign', { participantId: ana!, target: { kind: 'place', id: placeId(e, 'Command Post') }, at: T0 + 3 * HOUR });
    expect(leader()).toBe(ben);
    // The last one out leaves it without a leader.
    e.run('assign', { participantId: ben!, target: null, at: T0 + 3 * HOUR });
    expect(leader()).toBeNull();
  });

  it('rejects missing targets, field users and light-mode events', () => {
    const e = startedActivity();
    const pid = addMember(e, 'kcsara:1');
    expect(e.rejects('assign', { participantId: pid, target: team('nope'), at: T0 })).toBe('target_gone');
    expect(e.rejects('assign', { participantId: pid, target: null, at: T0 }, fieldMember('kcsara:1'))).toBe('forbidden');
    const light = startedActivity({ mode: 'light' });
    const p2 = addMember(light, 'kcsara:1');
    expect(light.rejects('assign', { participantId: p2, target: null, at: T0 })).toBe('light_mode');
  });
});

describe('teams', () => {
  it('disbanding moves members and equipment, and keeps the team as disbanded', () => {
    const e = startedActivity();
    const t = withTeam(e);
    const a = addMember(e, 'kcsara:1');
    const b = addMember(e, 'kcsara:2');
    for (const pid of [a, b]) e.run('assign', { participantId: pid, target: team(t), at: T0 + 2 * HOUR });
    e.run('createEquipment', { id: 'eq1', typeId: 'inventory-8', assignedTo: team(t) });
    const cp = { kind: 'place', id: placeId(e, 'Command Post') } as const;

    e.run('disbandTeam', { teamId: t, reassignTo: cp, at: T0 + 4 * HOUR });
    expect(teamStatusOf(e.view, t)).toBe('disbanded');
    expect(teamMembers(e.view, t)).toEqual([]);
    expect([currentTarget(e.view, a), currentTarget(e.view, b)]).toEqual([cp, cp]);
    expect(statusOf(e.view, a)).toBe('assigned');
    expect(e.get<EquipmentRec>('equipment', 'eq1')?.assignedTo).toEqual(cp);
    expect(e.rejects('assign', { participantId: a, target: team(t), at: T0 + 5 * HOUR })).toBe('target_gone');
  });

  it('disbanding to nowhere puts members back in staging', () => {
    const e = startedActivity();
    const t = withTeam(e);
    const a = addMember(e, 'kcsara:1');
    e.run('assign', { participantId: a, target: team(t), at: T0 + 2 * HOUR });
    e.run('disbandTeam', { teamId: t, reassignTo: null, at: T0 + 3 * HOUR });
    expect(statusOf(e.view, a)).toBe('staging');
  });

  it('deleting removes the team and its status history', () => {
    const e = startedActivity();
    const t = withTeam(e);
    e.run('setTeamStatus', { teamId: t, status: 'onScene', at: T0 + 2 * HOUR });
    e.run('deleteTeam', { teamId: t, reassignTo: null, at: T0 + 3 * HOUR });
    expect(e.get('team', t)).toBeUndefined();
    expect(e.all('teamStatus')).toEqual([]);
  });

  it('only makes a current member the leader, and clears blank text fields', () => {
    const e = startedActivity();
    const t = withTeam(e);
    const pid = addMember(e, 'kcsara:1');
    expect(e.rejects('setTeamLeader', { teamId: t, participantId: pid })).toBe('not_member');
    e.run('updateTeam', { id: t, gar: 'amber', assignment: 'Segment 4', notes: '' });
    expect(e.get<TeamRec>('team', t)).toMatchObject({ gar: 'amber', assignment: 'Segment 4', notes: null });
  });

  it("refuses a team name another team has, or one of its numbers", () => {
    const e = startedActivity();
    withTeam(e, 't1', 'Team 1');
    withTeam(e, 't2', 'Team 2');
    withTeam(e, 'th', 'Hasty');
    expect(e.rejects('createTeam', { id: 't3', name: ' hasty ' })).toBe('name_taken');
    expect(e.rejects('createTeam', { id: 't3', name: 'Dog 1' })).toBe('name_taken');
    expect(e.rejects('updateTeam', { id: 't2', name: 'Alpha 3 Bravo 1' })).toBe('name_taken');
    expect(teamNameConflict('Dog 13', ['Team 12', 'Team 13'])).toBe('Team 13 already uses 13');
    e.run('createTeam', { id: 't3', name: 'Dog 3' });
    e.run('updateTeam', { id: 't1', name: 'TEAM 1' }); // its own name, recased
    e.run('updateTeam', { id: 't2', name: 'Team 2', gar: 'red' });
    expect(e.get<TeamRec>('team', 't1')?.name).toBe('TEAM 1');
  });
});

describe('groups', () => {
  function groupWithLeaderTeam() {
    const e = startedActivity();
    const t = withTeam(e);
    e.run('createGroup', { id: 'g1', name: 'Division A' });
    e.run('setTeamGroup', { teamId: t, groupId: 'g1', at: T0 + HOUR });
    const leader = addMember(e, 'kcsara:1');
    const other = addMember(e, 'kcsara:2');
    e.run('assign', { participantId: leader, target: team(t), at: T0 + 2 * HOUR });
    e.run('setGroupLeader', { groupId: 'g1', participantId: leader });
    return { e, t, leader, other };
  }

  it("won't let the leader's team leave without a new leader or deleting the group", () => {
    const { e, t, other } = groupWithLeaderTeam();
    expect(e.rejects('setTeamGroup', { teamId: t, groupId: null, at: T0 + 3 * HOUR })).toBe('group_leader_on_team');
    e.run('setTeamGroup', { teamId: t, groupId: null, newLeaderId: other, at: T0 + 3 * HOUR });
    expect(e.get<GroupRec>('group', 'g1')?.leaderParticipantId).toBe(other);
    expect(e.get<TeamRec>('team', t)?.groupId).toBeNull();
  });

  it('can delete the group as the team leaves', () => {
    const { e, t } = groupWithLeaderTeam();
    e.run('setTeamGroup', { teamId: t, groupId: null, disbandGroup: true, at: T0 + 3 * HOUR });
    expect(e.get('group', 'g1')).toBeUndefined();
  });

  it('deleting a group frees its teams and moves people it held directly', () => {
    const { e, t, other } = groupWithLeaderTeam();
    e.run('assign', { participantId: other, target: { kind: 'group', id: 'g1' }, at: T0 + 2 * HOUR });
    e.run('deleteGroup', { groupId: 'g1', reassignTo: null, at: T0 + 3 * HOUR });
    expect(e.get<TeamRec>('team', t)?.groupId).toBeNull();
    expect(groupTeams(e.view, 'g1')).toEqual([]);
    expect(currentTarget(e.view, other)).toBeNull();
    expect(statusOf(e.view, other)).toBe('staging');
  });
});

describe('places, equipment and comms', () => {
  it('deleting a place moves its people', () => {
    const e = startedActivity();
    e.run('createPlace', { id: 'rc', name: 'Road Closure', lat: 47.4, lon: -121.6, notes: '' });
    const pid = addMember(e, 'kcsara:1');
    e.run('assign', { participantId: pid, target: { kind: 'place', id: 'rc' }, at: T0 + 2 * HOUR });
    expect(e.get<PlaceRec>('place', 'rc')?.notes).toBeNull();
    e.run('deletePlace', { placeId: 'rc', reassignTo: null, at: T0 + 3 * HOUR });
    expect(currentTarget(e.view, pid)).toBeNull();
    expect(e.rejects('deletePlace', { placeId: 'rc', reassignTo: null, at: T0 })).toBe('not_found');
  });

  it('names equipment from the catalogue, except custom items', () => {
    const e = startedActivity();
    e.run('createEquipment', { id: 'eq1', typeId: 'inventory-11', assignedTo: null });
    expect(e.get<EquipmentRec>('equipment', 'eq1')).toMatchObject({ name: 'Litter', category: 'Packaging' });
    expect(e.rejects('createEquipment', { id: 'eq2', typeId: 'inventory-0', assignedTo: null })).toBe('bad_args');
    e.run('createEquipment', { id: 'eq2', typeId: 'inventory-0', name: 'Sat phone', assignedTo: null });
    expect(e.get<EquipmentRec>('equipment', 'eq2')?.name).toBe('Sat phone');
    expect(e.rejects('createEquipment', { id: 'eq3', typeId: 'nope', assignedTo: null })).toBe('bad_args');
  });

  it('soft-deletes comms and keeps them command-only', () => {
    const e = startedActivity();
    e.run('addComm', { id: 'c1', from: 'Base', to: 'Team 1', message: 'Check in at 1500', at: T0 + HOUR });
    e.run('editComm', { id: 'c1', favorite: true });
    e.run('deleteComm', { id: 'c1' });
    expect(e.get<CommRec>('comm', 'c1')).toMatchObject({ favorite: true, removed: true });
    expect(e.rejects('editComm', { id: 'c1', message: 'x' })).toBe('removed');
    expect(e.rejects('addComm', { id: 'c2', from: '', to: '', message: 'hi', at: T0 }, fieldMember('kcsara:1'))).toBe('forbidden');
  });

  it('puts comms logged by hand at Normal, starred ones at Important, and automated ones at Auto', () => {
    const e = startedActivity();
    e.run('addComm', { id: 'c1', from: 'Base', to: 'Team 1', message: 'Check in at 1500', at: T0 + HOUR });
    expect(commLevel(e.get<CommRec>('comm', 'c1')!)).toBe(Level.Normal);
    e.run('editComm', { id: 'c1', favorite: true });
    expect(commLevel(e.get<CommRec>('comm', 'c1')!)).toBe(Level.Important);
    const entry = (automated: boolean, favorite = false) => ({ type: 'comm', id: 'c', from: '', to: '', message: 'm', favorite, removed: false, automated, at: T0, by: 'import' }) as CommRec;
    expect([commLevel(entry(true)), commLevel(entry(true, true))]).toEqual([Level.Auto, Level.Important]);
  });

  it("makes an edited automated comm a person's, but not when only favorited", () => {
    const e = startedActivity();
    // The legacy app's automated entries arrive by import, as records.
    e.records.set(keyOf('comm', 'c1'), { type: 'comm', id: 'c1', version: 1, from: 'Team 1', to: 'Command Post', message: 'In Transit', favorite: false, removed: false, legacy: true, automated: true, at: T0, by: 'import' } as CommRec);
    e.run('editComm', { id: 'c1', favorite: true });
    expect(e.get<CommRec>('comm', 'c1')).toMatchObject({ favorite: true, automated: true });
    e.run('editComm', { id: 'c1', favorite: false, at: T0 + 2 * HOUR });
    expect(e.get<CommRec>('comm', 'c1')).toMatchObject({ at: T0 + 2 * HOUR, automated: false });
    expect(commLevel(e.get<CommRec>('comm', 'c1')!)).toBe(Level.Normal);
  });
});
