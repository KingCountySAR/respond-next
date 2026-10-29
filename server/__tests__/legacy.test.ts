import { describe, expect, it } from 'vitest';
import { MapView, recKey } from '@sync/core';
import {
  Organization,
  commLog,
  currentTarget,
  currentUnitStatus,
  equipmentAt,
  getActivity,
  participantIdFor,
  statusOf,
  teamMembers,
  teamStatusOf,
  currentUnitOf,
  type ActivityUnitRec,
  type GroupRec,
  type ParticipantStatusRec,
  type PlaceRec,
  type TeamRec,
} from '@sync/domain';
import { ConversionError, convertActivity, convertLocation, legacyOrgIds, type LegacyActivity, type LegacyOrganizations } from '../src/legacy';

const org = (id: string, shortTitle: string, legacyId: string, parentId: string | null = 'umbrella') =>
  Organization.parse({ id, title: `${shortTitle} Unit`, shortTitle, parentId, legacyId, memberProvider: parentId ? null : 'members' });

const ORGS = [org('umbrella', 'SAR', '5', null), org('sheriff', 'SO', '2', null), org('esar', 'ESAR', '1'), org('rsvu', 'RSVU', '7'), org('spart', 'SPART', '9')];
const orgs: LegacyOrganizations = {
  byLegacyId: (id) => ORGS.find((o) => o.legacyId === id),
  all: () => ORGS,
  providerOf: (id) => (ORGS.find((o) => o.id === id)?.parentId === 'umbrella' || id === 'umbrella' ? 'members' : undefined),
};

const T0 = Date.UTC(2025, 5, 1, 16);
const MIN = 60_000;

function legacy(overrides: Partial<LegacyActivity> = {}): LegacyActivity {
  return {
    id: '0266c6a2-a344-493f-9cd6-b01b56b7c302',
    idNumber: '25-0123',
    title: 'Lost hiker',
    description: 'Overdue on Mt. Si',
    location: { id: 'loc-1', title: 'Mt. Si TH', lat: '47.48', lon: '', address: '', isSaved: true },
    mapId: 'ABC12',
    ownerOrgId: '2',
    isMission: true,
    asMission: true,
    forceStandbyOnly: null,
    startTime: T0,
    endTime: T0 + 300 * MIN,
    earlySignInWindow: null,
    participants: {
      '85205': {
        id: '85205',
        firstname: 'Anna',
        lastname: 'Lee',
        organizationId: 1,
        tags: ['OL'],
        miles: 40,
        eta: null,
        // Newest first, as respond-next kept it.
        timeline: [
          { id: 's3', time: T0 + 60 * MIN, status: 6, organizationId: 1, lastUpdatedBy: { id: '9', name: 'Pat Nine' } },
          { id: 's2', time: T0 + 30 * MIN, status: 5, organizationId: 1, lastUpdatedBy: { id: '85205', name: 'Anna Lee' } },
          { time: null, status: 3, organizationId: 1 },
          { time: T0 + 5 * MIN, status: 3, organizationId: 1 },
        ],
      },
      '1234': { id: '1234', firstname: 'Ben', lastname: 'Ode', organizationId: '7', timeline: [{ id: 's9', time: T0 + 10 * MIN, status: 2, organizationId: '7' }] },
    },
    organizations: {
      '1': { id: '1', title: 'Explorer SAR', rosterName: 'ESAR', timeline: [{ time: T0, status: 4 }] },
      '2': { id: '2', title: 'Sheriff', rosterName: 'SO', timeline: [{ time: T0, status: 0 }] },
      // Legacy id 7 was given to two units; this activity's is SPART's.
      '7': { id: '7', title: 'Ski Patrol', rosterName: 'SPART', timeline: [{ time: T0, status: 3 }] },
    },
    teams: [{ id: 'team-1', name: 'Team 1', gar: 'amber', status: 'On Assignment', assignment: 'Trail', notes: '', assignedParticipants: ['85205'], assignedEquipment: [{ id: 'inventory-34', type: 'Medical', name: 'A.E.D - Basic', uuid: 'eq-1' }], teamLeaderParticipantId: '85205' }],
    groups: [{ id: 'group-1', name: 'Rescue', leaderId: '85205', assignedTeams: ['team-1'], assignedParticipants: [], assignedEquipment: [] }],
    places: [{ id: 'place-cp', name: 'Command Post', assignedParticipants: [], assignedEquipment: [{ id: 'nope', name: 'Thermos' }] }],
    comms: [
      { id: 'c1', from: 'Base', to: 'Team 1', message: 'Go', timestamp: T0 + 40 * MIN, isAutomated: false, isDeleted: false, isFavorite: true },
      { id: 'c2', from: '', to: '', message: 'Team 1 status: On Assignment', timestamp: T0 + 41 * MIN, isAutomated: true, isDeleted: false, isFavorite: false },
    ],
    ...overrides,
  };
}

const view = (a: LegacyActivity) => {
  const { records } = convertActivity(a, orgs);
  return new MapView(new Map(records.map((r) => [recKey(r), r])));
};

describe('legacy import', () => {
  it('keeps the activity and its fields, closed when it has an end time', () => {
    const activity = getActivity(view(legacy()))!;
    expect(activity).toMatchObject({
      idNumber: '25-0123',
      kind: 'mission',
      title: 'Lost hiker',
      location: { title: 'Mt. Si TH', lat: 47.48, lon: null, address: null, savedId: 'loc-1' },
      ownerOrgId: 'sheriff',
      mode: 'full',
      standbyOnly: false,
      closed: true,
      endTime: T0 + 300 * MIN,
      earlySignInWindow: null,
      removedAt: null,
    });
    expect(getActivity(view(legacy({ isMission: false, asMission: true, endTime: null, earlySignInWindow: undefined, removeTime: T0 })))).toMatchObject({
      kind: 'training',
      mode: 'full',
      closed: false,
      earlySignInWindow: 4 * 60 * MIN,
      removedAt: T0,
    });
  });

  it("names who made someone else's status entry, and why the system made one", () => {
    const anna = participantIdFor('members:85205');
    const ben = participantIdFor('members:1234');
    const v = view(
      legacy({
        participants: {
          ...legacy().participants,
          '1234': {
            id: '1234',
            firstname: 'Ben',
            lastname: 'Ode',
            organizationId: '7',
            timeline: [
              { id: 's11', time: T0 + 300 * MIN, status: 4, organizationId: '7', lastUpdatedBy: { id: 'system', name: 'System: Activity Closed' } },
              { id: 's10', time: T0 + 20 * MIN, status: 4, organizationId: '7', lastUpdatedBy: { id: 'system', name: 'System: Signed In To Another Activity' } },
              { id: 's9', time: T0 + 10 * MIN, status: 2, organizationId: '7' },
            ],
          },
        },
      }),
    );
    const entry = (id: string) => v.get<ParticipantStatusRec>('participantStatus', id)!;
    expect(entry('s3')).toMatchObject({ participantId: anna, byName: 'Pat Nine' });
    expect(entry('s2').byName).toBeUndefined();
    expect(entry('s11')).toMatchObject({ participantId: ben, cause: 'Activity closed' });
    expect(entry('s10')).toMatchObject({ cause: 'Signed in to another activity' });
    expect(entry('s10').byName).toBeUndefined();
    expect(entry('s9').cause).toBeUndefined();
  });

  it('gives people their member provider ref, statuses and units', () => {
    const v = view(legacy());
    const anna = participantIdFor('members:85205');
    const ben = participantIdFor('members:1234');
    expect(v.get('participant', anna)).toMatchObject({ personRef: 'members:85205', firstname: 'Anna', memberTags: ['OL'], memberTagsUnitId: expect.any(String), miles: 40, eta: null });
    expect(statusOf(v, anna)).toBe('assigned');
    expect(statusOf(v, anna, T0 + 20 * MIN)).toBe('responding');
    expect(currentUnitOf(v, anna)).toBe('esar');
    // Legacy 7 under SPART's roster name is SPART, not RSVU.
    expect(statusOf(v, ben)).toBe('standby');
    expect(currentUnitOf(v, ben)).toBe('spart');
    expect(v.get<ActivityUnitRec>('activityUnit', 'spart')).toMatchObject({ title: 'Ski Patrol', rosterName: 'SPART' });
    expect(v.get('activityUnit', 'rsvu')).toBeUndefined();
    expect(currentUnitStatus(v, 'esar')?.status).toBe('responding');
    expect(currentUnitStatus(v, 'sheriff')?.status).toBe('unknown');
  });

  it('brings over teams, groups, places, equipment and comms, with the default places', () => {
    const v = view(legacy());
    const anna = participantIdFor('members:85205');
    expect(v.get<TeamRec>('team', 'team-1')).toMatchObject({ gar: 'amber', assignment: 'Trail', notes: null, leaderParticipantId: anna, groupId: 'group-1' });
    expect(teamStatusOf(v, 'team-1')).toBe('onAssignment');
    expect(teamMembers(v, 'team-1').map((p) => p.id)).toEqual([anna]);
    expect(currentTarget(v, anna)).toEqual({ kind: 'team', id: 'team-1' });
    expect(v.get<GroupRec>('group', 'group-1')?.leaderParticipantId).toBe(anna);
    expect(equipmentAt(v, { kind: 'team', id: 'team-1' })).toMatchObject([{ id: 'eq-1', typeId: 'inventory-34', category: 'Medical', name: 'A.E.D - Basic' }]);
    expect(equipmentAt(v, { kind: 'place', id: 'place-cp' })).toMatchObject([{ typeId: 'inventory-0', name: 'Thermos' }]);
    expect([...v.scan<PlaceRec>('place')].map((p) => p.name).sort()).toEqual(['Command Post', 'Field']);
    expect(commLog(v)).toMatchObject([
      { id: 'c1', message: 'Go', favorite: true, legacy: true },
      { id: 'c2', automated: true, legacy: true },
    ]);
    expect(commLog(v)[0]).not.toHaveProperty('automated');
  });

  it('notes what it leaves out, and makes the same records each time', () => {
    const first = convertActivity(legacy(), orgs);
    expect(first.notes).toEqual(['status entry without a time, left out']);
    expect(convertActivity(legacy(), orgs).records).toEqual(first.records);
    const places = (a: LegacyActivity) => [...view(a).scan<PlaceRec>('place')].map((p) => `${p.id} ${p.name}`).sort();
    expect(places(legacy({ places: null }))).toHaveLength(2);
    expect(places(legacy({ places: null }))).toEqual(places(legacy({ places: null })));
  });

  it('refuses statuses and organizations it has no mapping for', () => {
    const bad = legacy();
    bad.participants['85205']!.timeline[0]!.status = 42;
    expect(() => convertActivity(bad, orgs)).toThrow(ConversionError);
    expect(() => convertActivity(legacy({ ownerOrgId: '99' }), orgs)).toThrow('no organization has legacyId 99');
    expect([...legacyOrgIds([legacy()])].sort()).toEqual(['1', '2', '7']);
  });

  it('converts saved locations, leaving out those without a title', () => {
    expect(convertLocation({ id: 'l1', title: ' Little Si TH ', lat: '47.48', lon: '-121.75', address: '', description: 'Lot' })).toEqual({ id: 'l1', title: 'Little Si TH', lat: 47.48, lon: -121.75, address: null, description: 'Lot' });
    expect(convertLocation({ id: 'l2', title: '' })).toBeNull();
  });
});
