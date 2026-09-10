import { produce } from 'immer';

import { ActivityState, eventReducersByType } from '..';
import { ActivityEvents, CommsEvents, ParticipantEvents, PlaceEvents, TeamEvents } from '../events';
import { createNewActivity, ParticipantStatus } from '../types/activity';
import { CommunicationsLogEntry, createDefaultOperations, createNewPlace, createNewTeam, DEFAULT_PLACES } from '../types/operations';

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
    next = apply(next, PlaceEvents.PlaceDeleted({ activityId, placeId: place.id }));
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

  it('ParticipantUpdated creates a new participant with an undefined tags (so tagging can fire)', () => {
    const next = apply(
      stateWithActivity(activityId),
      ParticipantEvents.ParticipantUpdated({ activityId, participant: { id: 'p1', firstname: 'Ann', lastname: 'Lee', organizationId: '1' }, update: { time: 100, status: ParticipantStatus.SignedIn } }),
    );
    const person = next.list[0].participants['p1'];
    expect(person.timeline[0].status).toBe(ParticipantStatus.SignedIn);
    expect(person.tags).toBeUndefined();
  });

  it('ParticipantTagged sets tags on an existing participant', () => {
    let next = apply(
      stateWithActivity(activityId),
      ParticipantEvents.ParticipantUpdated({ activityId, participant: { id: 'p1', firstname: 'Ann', lastname: 'Lee', organizationId: '1' }, update: { time: 100, status: ParticipantStatus.SignedIn } }),
    );
    next = apply(next, ParticipantEvents.ParticipantTagged({ activityId, participantId: 'p1', tags: ['Snow', 'OL'] }));
    expect(next.list[0].participants['p1'].tags).toEqual(['Snow', 'OL']);
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

  describe('TeamMemberAssigned', () => {
    // Two teams (Alpha holds p1 as lead) plus a place, on one activity.
    function stateWithTeams(): ActivityState {
      const state = stateWithActivity(activityId);
      state.list[0].teams = [
        { ...createNewTeam('Alpha'), id: 'alpha', assignedParticipants: ['p1'] },
        { ...createNewTeam('Bravo'), id: 'bravo' },
      ];
      state.list[0].places = [{ ...createNewPlace('CP'), id: 'cp' }];
      return state;
    }

    it('moves a member between teams, updating both lists and the source lead', () => {
      const next = apply(stateWithTeams(), TeamEvents.TeamMemberAssigned({ activityId, participantId: 'p1', target: { type: 'team', id: 'bravo' } }));
      const [alpha, bravo] = next.list[0].teams;
      expect(alpha.assignedParticipants).toEqual([]);
      expect(bravo.assignedParticipants).toEqual(['p1']);
    });

    it('asLeader puts the member first (becomes the team lead)', () => {
      const state = stateWithTeams();
      state.list[0].teams[1].assignedParticipants = ['p2', 'p3'];
      const next = apply(state, TeamEvents.TeamMemberAssigned({ activityId, participantId: 'p1', target: { type: 'team', id: 'bravo', asLeader: true } }));
      const bravo = next.list[0].teams[1];
      expect(bravo.assignedParticipants).toEqual(['p1', 'p2', 'p3']);
    });

    it('moves a member from a team to a place', () => {
      const next = apply(stateWithTeams(), TeamEvents.TeamMemberAssigned({ activityId, participantId: 'p1', target: { type: 'place', id: 'cp' } }));
      expect(next.list[0].teams[0].assignedParticipants).toEqual([]);
      expect(next.list[0].places?.[0].assignedParticipants).toEqual(['p1']);
    });

    it('unassigns (no target) by removing the member from its team', () => {
      const next = apply(stateWithTeams(), TeamEvents.TeamMemberAssigned({ activityId, participantId: 'p1', target: undefined }));
      expect(next.list[0].teams[0].assignedParticipants).toEqual([]);
    });

    it('promoting within the same team reorders without duplicating', () => {
      const state = stateWithTeams();
      state.list[0].teams[0].assignedParticipants = ['p0', 'p1', 'p2'];
      const next = apply(state, TeamEvents.TeamMemberAssigned({ activityId, participantId: 'p1', target: { type: 'team', id: 'alpha', asLeader: true } }));
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
    legacy.comms = undefined as never;
    legacy.staff = undefined as never;
    legacy.places = undefined as never;
    const state: ActivityState = { list: [legacy] };

    let next = apply(state, ActivityEvents.OperationsDecorated({ activityId, operations: createDefaultOperations() }));
    expect(next.list[0].teams).toEqual([]);
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
