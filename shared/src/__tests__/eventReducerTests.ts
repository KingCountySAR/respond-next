import { produce } from 'immer';

import { ActivityState, eventReducersByType } from '..';
import { ActivityEvents, CommsEvents, GroupEvents, ParticipantEvents, PlaceEvents, ResourceEvents, TeamEvents } from '../events';
import { createNewActivity, ParticipantStatus } from '../types/activity';
import { CommunicationsLogEntry, createDefaultOperations, createNewGroup, createNewPlace, createNewTeam, DEFAULT_PLACES } from '../types/operations';

function stateWithActivity(activityId: string): ActivityState {
  const activity = createNewActivity();
  activity.id = activityId;
  activity.places = []; // createNewActivity seeds default places; start empty for clarity
  return { list: [activity] };
}

function apply<E extends { type: string; payload: unknown }>(state: ActivityState, event: E): ActivityState {
  return produce(state, (draft) => eventReducersByType[event.type](draft, event.payload as never));
}

describe('Event Reducers', () => {
  const activityId = '369a6656-19e5-4828-8b40-db325d78ca0a';

  it('PlaceCreated appends a place', () => {
    const place = createNewPlace('Command Post');
    const next = apply(stateWithActivity(activityId), PlaceEvents.PlaceCreated({ activityId, place }));
    expect(next.list[0].places).toEqual([place]);
  });

  it('PlaceDeleted removes a place by id', () => {
    const place = createNewPlace('Staging');
    let next = apply(stateWithActivity(activityId), PlaceEvents.PlaceCreated({ activityId, place }));
    next = apply(next, PlaceEvents.PlaceDeleted({ activityId, placeId: place.id, target: undefined }));
    expect(next.list[0].places).toEqual([]);
  });

  it('CommLogged appends the server-authored entry', () => {
    const comm: CommunicationsLogEntry = { id: 'srv-1', from: DEFAULT_PLACES.base, message: 'Staging established', timestamp: 111, isAutomated: true };
    const next = apply(stateWithActivity(activityId), CommsEvents.CommLogged({ activityId, comm }));
    expect(next.list[0].comms).toEqual([comm]);
  });

  it('CommLogged appends each server-authored entry (distinct ids)', () => {
    let next = apply(stateWithActivity(activityId), CommsEvents.CommLogged({ activityId, comm: { id: 'srv-1', from: DEFAULT_PLACES.base, message: 'one', timestamp: 111 } }));
    next = apply(next, CommsEvents.CommLogged({ activityId, comm: { id: 'srv-2', from: DEFAULT_PLACES.base, message: 'two', timestamp: 112 } }));
    expect(next.list[0].comms?.map((c) => c.id)).toEqual(['srv-1', 'srv-2']);
  });

  it('CommUpdated merges fields into an existing entry', () => {
    const comm: CommunicationsLogEntry = { id: 'srv-1', from: DEFAULT_PLACES.base, message: 'draft', timestamp: 111 };
    let next = apply(stateWithActivity(activityId), CommsEvents.CommLogged({ activityId, comm }));
    next = apply(next, CommsEvents.CommUpdated({ activityId, commId: 'srv-1', updates: { message: 'final' } }));
    expect(next.list[0].comms?.[0].message).toBe('final');
  });

  it('ParticipantTimelineAdded creates a new participant when given an identity (name + tags together)', () => {
    // PREPARE: a bare activity with no participants yet.
    // TEST: apply ParticipantTimelineAdded for an unknown participant id, carrying an identity with tags.
    const next = apply(
      stateWithActivity(activityId),
      ParticipantEvents.ParticipantTimelineAdded({
        activityId,
        participantId: 'p1',
        participant: { firstname: 'Ann', lastname: 'Lee', tags: ['Snow', 'OL'] },
        update: { id: 'u1', time: 100, status: ParticipantStatus.SignedIn, organizationId: '1' },
      }),
    );
    // VERIFY: the participant is created from the given identity, with the entry as their timeline and the given tags.
    const person = next.list[0].participants['p1'];
    expect(person).toMatchObject({ firstname: 'Ann', lastname: 'Lee', organizationId: '1', tags: ['Snow', 'OL'] });
    expect(person.timeline[0].status).toBe(ParticipantStatus.SignedIn);
  });

  it('ParticipantTimelineAdded appends a further entry for an existing participant without needing an identity', () => {
    // PREPARE: a participant already created by a first ParticipantTimelineAdded.
    let next = apply(
      stateWithActivity(activityId),
      ParticipantEvents.ParticipantTimelineAdded({
        activityId,
        participantId: 'p1',
        participant: { firstname: 'Ann', lastname: 'Lee', tags: [] },
        update: { id: 'u1', time: 100, status: ParticipantStatus.SignedIn, organizationId: '1' },
      }),
    );
    // TEST: apply a second ParticipantTimelineAdded for the same participant, with no `participant` identity this time.
    next = apply(next, ParticipantEvents.ParticipantTimelineAdded({ activityId, participantId: 'p1', update: { id: 'u2', time: 200, status: ParticipantStatus.Available, organizationId: '1' } }));
    // VERIFY: the new entry is unshifted to the front of the timeline (most recent first).
    expect(next.list[0].participants['p1'].timeline[0].status).toBe(ParticipantStatus.Available);
  });

  it("ParticipantTimelineAdded keeps the participant's organizationId in sync with the latest entry", () => {
    // PREPARE: a participant created under org '1'.
    let next = apply(
      stateWithActivity(activityId),
      ParticipantEvents.ParticipantTimelineAdded({
        activityId,
        participantId: 'p1',
        participant: { firstname: 'Ann', lastname: 'Lee', tags: [] },
        update: { id: 'u1', time: 100, status: ParticipantStatus.SignedIn, organizationId: '1' },
      }),
    );
    // TEST: apply a further entry under a different org.
    next = apply(next, ParticipantEvents.ParticipantTimelineAdded({ activityId, participantId: 'p1', update: { id: 'u2', time: 200, status: ParticipantStatus.Available, organizationId: '2' } }));
    // VERIFY: the participant's top-level organizationId follows the new (latest) entry.
    expect(next.list[0].participants['p1'].organizationId).toBe('2');
  });

  it("ParticipantTimelineCorrected resyncs the participant's organizationId when correcting the latest entry", () => {
    // PREPARE: a participant with two timeline entries — u2 (latest, org '2') then u1 (org '1').
    let next = apply(
      stateWithActivity(activityId),
      ParticipantEvents.ParticipantTimelineAdded({
        activityId,
        participantId: 'p1',
        participant: { firstname: 'Ann', lastname: 'Lee', tags: [] },
        update: { id: 'u1', time: 100, status: ParticipantStatus.SignedIn, organizationId: '1' },
      }),
    );
    next = apply(next, ParticipantEvents.ParticipantTimelineAdded({ activityId, participantId: 'p1', update: { id: 'u2', time: 200, status: ParticipantStatus.Available, organizationId: '2' } }));
    // TEST: correct the latest entry (u2) to a different org.
    next = apply(next, ParticipantEvents.ParticipantTimelineCorrected({ activityId, participantId: 'p1', update: { id: 'u2', time: 200, status: ParticipantStatus.Available, organizationId: '3' } }));
    // VERIFY: the edited entry is replaced, and the participant's organizationId re-syncs to match it.
    expect(next.list[0].participants['p1'].timeline[0]).toMatchObject({ id: 'u2', organizationId: '3' });
    expect(next.list[0].participants['p1'].organizationId).toBe('3');
  });

  it("ParticipantTimelineCorrected leaves the participant's organizationId alone when correcting an older entry", () => {
    // PREPARE: a participant with two timeline entries — u2 (latest, org '2') then u1 (org '1').
    let next = apply(
      stateWithActivity(activityId),
      ParticipantEvents.ParticipantTimelineAdded({
        activityId,
        participantId: 'p1',
        participant: { firstname: 'Ann', lastname: 'Lee', tags: [] },
        update: { id: 'u1', time: 100, status: ParticipantStatus.SignedIn, organizationId: '1' },
      }),
    );
    next = apply(next, ParticipantEvents.ParticipantTimelineAdded({ activityId, participantId: 'p1', update: { id: 'u2', time: 200, status: ParticipantStatus.Available, organizationId: '2' } }));
    // TEST: correct the older entry (u1), not the latest.
    next = apply(next, ParticipantEvents.ParticipantTimelineCorrected({ activityId, participantId: 'p1', update: { id: 'u1', time: 90, status: ParticipantStatus.SignedIn, organizationId: '9' } }));
    // VERIFY: the older entry is updated, but the participant's organizationId still matches the (unaffected) latest entry.
    expect(next.list[0].participants['p1'].timeline.find((e) => e.id === 'u1')).toMatchObject({ organizationId: '9' });
    expect(next.list[0].participants['p1'].organizationId).toBe('2');
  });

  it('ParticipantTimelineAdded replaces name and tags with freshly-resolved values on an org switch', () => {
    // PREPARE: a participant created under org '1' with resolved tags.
    let next = apply(
      stateWithActivity(activityId),
      ParticipantEvents.ParticipantTimelineAdded({
        activityId,
        participantId: 'p1',
        participant: { firstname: 'Ann', lastname: 'Lee', tags: ['Snow', 'OL'] },
        update: { id: 'u1', time: 100, status: ParticipantStatus.SignedIn, organizationId: '1' },
      }),
    );
    // TEST: apply a further entry switching them to a different org, carrying freshly-resolved identity/tags.
    next = apply(
      next,
      ParticipantEvents.ParticipantTimelineAdded({
        activityId,
        participantId: 'p1',
        participant: { firstname: 'Ann', lastname: 'Lee-Smith', tags: ['Rope'] },
        update: { id: 'u2', time: 200, status: ParticipantStatus.Available, organizationId: '2' },
      }),
    );
    // VERIFY: the org-1-specific tags (and name) are replaced by the org-2 values — not merged or cleared.
    expect(next.list[0].participants['p1']).toMatchObject({ lastname: 'Lee-Smith', tags: ['Rope'] });
  });

  it('ParticipantTimelineAdded leaves name/tags alone when no identity is given (not an org switch)', () => {
    // PREPARE: a participant created under org '1' with resolved tags.
    let next = apply(
      stateWithActivity(activityId),
      ParticipantEvents.ParticipantTimelineAdded({
        activityId,
        participantId: 'p1',
        participant: { firstname: 'Ann', lastname: 'Lee', tags: ['Snow', 'OL'] },
        update: { id: 'u1', time: 100, status: ParticipantStatus.SignedIn, organizationId: '1' },
      }),
    );
    // TEST: apply a further entry under the same org, with no identity (the normal, non-switching case).
    next = apply(next, ParticipantEvents.ParticipantTimelineAdded({ activityId, participantId: 'p1', update: { id: 'u2', time: 200, status: ParticipantStatus.Available, organizationId: '1' } }));
    // VERIFY: their name and tags are untouched.
    expect(next.list[0].participants['p1']).toMatchObject({ lastname: 'Lee', tags: ['Snow', 'OL'] });
  });

  it('TeamCreated then TeamUpdated changes the team status/gar', () => {
    const team = createNewTeam('Team 1');
    let next = apply(stateWithActivity(activityId), TeamEvents.TeamCreated({ activityId, team }));
    expect(next.list[0].teams.map((t) => t.name)).toEqual(['Team 1']);
    next = apply(next, TeamEvents.TeamUpdated({ activityId, updates: { id: team.id, gar: 'red', status: 'On Assignment' } }));
    expect(next.list[0].teams[0].gar).toBe('red');
    expect(next.list[0].teams[0].status).toBe('On Assignment');
  });

  it('TeamDisbanded marks the team Disbanded without touching its assignments', () => {
    const team = { ...createNewTeam('Team 1'), assignedParticipants: ['p1'] };
    let next = apply(stateWithActivity(activityId), TeamEvents.TeamCreated({ activityId, team }));
    next = apply(next, TeamEvents.TeamDisbanded({ activityId, id: team.id, target: undefined }));
    expect(next.list[0].teams[0].status).toBe('Disbanded');
    expect(next.list[0].teams[0].assignedParticipants).toEqual(['p1']);
  });

  it('TeamDeleted removes the team entirely', () => {
    const team = createNewTeam('Team 1');
    let next = apply(stateWithActivity(activityId), TeamEvents.TeamCreated({ activityId, team }));
    next = apply(next, TeamEvents.TeamDeleted({ activityId, id: team.id, target: undefined }));
    expect(next.list[0].teams).toEqual([]);
  });

  it('GroupCreated then GroupUpdated changes the group name/leader', () => {
    const group = createNewGroup('Rescue Group');
    let next = apply(stateWithActivity(activityId), GroupEvents.GroupCreated({ activityId, group }));
    expect(next.list[0].groups.map((g) => g.name)).toEqual(['Rescue Group']);
    next = apply(next, GroupEvents.GroupUpdated({ activityId, group: { ...group, leaderId: 'p1' } }));
    expect(next.list[0].groups[0].leaderId).toBe('p1');
  });

  it('GroupDeleted removes the group entirely', () => {
    const group = createNewGroup('Rescue Group');
    let next = apply(stateWithActivity(activityId), GroupEvents.GroupCreated({ activityId, group }));
    next = apply(next, GroupEvents.GroupDeleted({ activityId, id: group.id, target: undefined }));
    expect(next.list[0].groups).toEqual([]);
  });

  describe('ParticipantAssigned', () => {
    // Two teams (Alpha holds p1 as lead) plus a place and a group, on one activity.
    function stateWithTeams(): ActivityState {
      const state = stateWithActivity(activityId);
      state.list[0].teams = [
        { ...createNewTeam('Alpha'), id: 'alpha', assignedParticipants: ['p1'] },
        { ...createNewTeam('Bravo'), id: 'bravo' },
      ];
      state.list[0].places = [{ ...createNewPlace('CP'), id: 'cp' }];
      state.list[0].groups = [{ ...createNewGroup('Rescue Group'), id: 'rescue' }];
      return state;
    }

    it('moves a member between teams, updating both lists and the source lead', () => {
      const next = apply(stateWithTeams(), ResourceEvents.ParticipantAssigned({ activityId, participantId: 'p1', target: { type: 'team', id: 'bravo' } }));
      const [alpha, bravo] = next.list[0].teams;
      expect(alpha.assignedParticipants).toEqual([]);
      expect(bravo.assignedParticipants).toEqual(['p1']);
    });

    it('asLeader puts the member first (becomes the team lead)', () => {
      const state = stateWithTeams();
      state.list[0].teams[1].assignedParticipants = ['p2', 'p3'];
      const next = apply(state, ResourceEvents.ParticipantAssigned({ activityId, participantId: 'p1', target: { type: 'team', id: 'bravo', asLeader: true } }));
      const bravo = next.list[0].teams[1];
      expect(bravo.assignedParticipants).toEqual(['p1', 'p2', 'p3']);
    });

    it('moves a member from a team to a place', () => {
      const next = apply(stateWithTeams(), ResourceEvents.ParticipantAssigned({ activityId, participantId: 'p1', target: { type: 'place', id: 'cp' } }));
      expect(next.list[0].teams[0].assignedParticipants).toEqual([]);
      expect(next.list[0].places?.[0].assignedParticipants).toEqual(['p1']);
    });

    it('moves a member from a team to a group', () => {
      const next = apply(stateWithTeams(), ResourceEvents.ParticipantAssigned({ activityId, participantId: 'p1', target: { type: 'group', id: 'rescue' } }));
      expect(next.list[0].teams[0].assignedParticipants).toEqual([]);
      expect(next.list[0].groups?.[0].assignedParticipants).toEqual(['p1']);
    });

    it('unassigns (no target) by removing the member from its team', () => {
      const next = apply(stateWithTeams(), ResourceEvents.ParticipantAssigned({ activityId, participantId: 'p1', target: undefined }));
      expect(next.list[0].teams[0].assignedParticipants).toEqual([]);
    });

    it('promoting within the same team reorders without duplicating', () => {
      const state = stateWithTeams();
      state.list[0].teams[0].assignedParticipants = ['p0', 'p1', 'p2'];
      const next = apply(state, ResourceEvents.ParticipantAssigned({ activityId, participantId: 'p1', target: { type: 'team', id: 'alpha', asLeader: true } }));
      expect(next.list[0].teams[0].assignedParticipants).toEqual(['p1', 'p0', 'p2']);
    });
  });

  it('StaffUpdated merges the role assignment map', () => {
    let next = apply(stateWithActivity(activityId), TeamEvents.StaffUpdated({ activityId, staff: { 'Rescue Group': 'p1' } }));
    next = apply(next, TeamEvents.StaffUpdated({ activityId, staff: { 'Medical Group': 'p2' } }));
    expect(next.list[0].staff).toEqual({ 'Rescue Group': 'p1', 'Medical Group': 'p2' });
  });

  it('OperationsDecorated seeds missing operations and is idempotent per-property', () => {
    // Simulate a legacy activity loaded without its operations properties.
    const legacy = createNewActivity();
    legacy.id = activityId;
    legacy.teams = undefined as never;
    legacy.groups = undefined as never;
    legacy.comms = undefined as never;
    legacy.staff = undefined as never;
    legacy.places = undefined as never;
    const state: ActivityState = { list: [legacy] };

    let next = apply(state, ActivityEvents.OperationsDecorated({ activityId, operations: createDefaultOperations() }));
    expect(next.list[0].teams).toEqual([]);
    expect(next.list[0].groups).toEqual([]);
    expect(next.list[0].comms).toEqual([]);
    expect(next.list[0].staff).toEqual({});
    expect(next.list[0].places?.map((p) => p.name)).toEqual([DEFAULT_PLACES.base, DEFAULT_PLACES.field]);

    // A second decorate (e.g. another client racing on load) must not clobber
    // real data added in the meantime.
    const seededPlaces = next.list[0].places!;
    next = apply(next, TeamEvents.TeamCreated({ activityId, team: createNewTeam('Team 1') }));
    next = apply(next, ActivityEvents.OperationsDecorated({ activityId, operations: createDefaultOperations() }));
    expect(next.list[0].teams.map((t) => t.name)).toEqual(['Team 1']);
    expect(next.list[0].places).toEqual(seededPlaces);
  });

  it('ActivityUpdated merges summary fields (create-or-update)', () => {
    const next = apply(stateWithActivity(activityId), ActivityEvents.ActivityUpdated({ updates: { id: activityId, isMission: true, asMission: true } }));
    expect(next.list[0].isMission).toBe(true);
    expect(next.list[0].asMission).toBe(true);
  });
});
