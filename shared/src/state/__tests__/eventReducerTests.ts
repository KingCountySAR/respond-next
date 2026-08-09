import { produce } from 'immer';

import { ActivityState } from '..';
import { ActivityEvents, CommsEvents, ParticipantEvents, PlaceEvents, TeamEvents } from '../../events';
import { createNewActivity, ParticipantStatus } from '../../types/activity';
import { CommunicationsLogEntry, createNewPlace, createNewTeam } from '../../types/operations';
import { BasicEventReducers } from '../eventReducers';

function stateWithActivity(activityId: string): ActivityState {
  const activity = createNewActivity();
  activity.id = activityId;
  activity.places = []; // createNewActivity seeds default places; start empty for clarity
  return { list: [activity] };
}

function apply<E extends { type: string; payload: unknown }>(state: ActivityState, event: E): ActivityState {
  return produce(state, (draft) => BasicEventReducers[event.type as keyof typeof BasicEventReducers](draft, event as never));
}

describe('Event Reducers', () => {
  const activityId = '369a6656-19e5-4828-8b40-db325d78ca0a';

  it('PlaceCreated appends a place', () => {
    const place = createNewPlace('Command Post');
    const next = apply(stateWithActivity(activityId), PlaceEvents.PlaceCreated(activityId, place));
    expect(next.list[0].places).toEqual([place]);
  });

  it('PlaceDeleted removes a place by id', () => {
    const place = createNewPlace('Staging');
    let next = apply(stateWithActivity(activityId), PlaceEvents.PlaceCreated(activityId, place));
    next = apply(next, PlaceEvents.PlaceDeleted(activityId, place.id));
    expect(next.list[0].places).toEqual([]);
  });

  it('CommLogged appends the server-authored entry', () => {
    const comm: CommunicationsLogEntry = { id: 'srv-1', from: 'CP', message: 'Staging established', timestamp: 111, isAutomated: true };
    const next = apply(stateWithActivity(activityId), CommsEvents.CommLogged(activityId, comm));
    expect(next.list[0].comms).toEqual([comm]);
  });

  it('CommLogged appends each server-authored entry (distinct ids)', () => {
    let next = apply(stateWithActivity(activityId), CommsEvents.CommLogged(activityId, { id: 'srv-1', from: 'CP', message: 'one', timestamp: 111 }));
    next = apply(next, CommsEvents.CommLogged(activityId, { id: 'srv-2', from: 'CP', message: 'two', timestamp: 112 }));
    expect(next.list[0].comms?.map((c) => c.id)).toEqual(['srv-1', 'srv-2']);
  });

  it('CommUpdated merges fields into an existing entry', () => {
    const comm: CommunicationsLogEntry = { id: 'srv-1', from: 'CP', message: 'draft', timestamp: 111 };
    let next = apply(stateWithActivity(activityId), CommsEvents.CommLogged(activityId, comm));
    next = apply(next, CommsEvents.CommUpdated(activityId, 'srv-1', { message: 'final' }));
    expect(next.list[0].comms?.[0].message).toBe('final');
  });

  it('ParticipantUpdated creates a new participant with an undefined tags (so tagging can fire)', () => {
    const next = apply(stateWithActivity(activityId), ParticipantEvents.ParticipantUpdated(activityId, { id: 'p1', firstname: 'Ann', lastname: 'Lee', organizationId: '1' }, { time: 100, status: ParticipantStatus.SignedIn }));
    const person = next.list[0].participants['p1'];
    expect(person.timeline[0].status).toBe(ParticipantStatus.SignedIn);
    expect(person.tags).toBeUndefined();
  });

  it('ParticipantTagged sets tags on an existing participant', () => {
    let next = apply(stateWithActivity(activityId), ParticipantEvents.ParticipantUpdated(activityId, { id: 'p1', firstname: 'Ann', lastname: 'Lee', organizationId: '1' }, { time: 100, status: ParticipantStatus.SignedIn }));
    next = apply(next, ParticipantEvents.ParticipantTagged(activityId, 'p1', ['Snow', 'OL']));
    expect(next.list[0].participants['p1'].tags).toEqual(['Snow', 'OL']);
  });

  it('TeamCreated then TeamUpdated changes the team status/gar', () => {
    const team = createNewTeam('Team 1');
    let next = apply(stateWithActivity(activityId), TeamEvents.TeamCreated(activityId, team));
    expect(next.list[0].teams.map((t) => t.name)).toEqual(['Team 1']);
    next = apply(next, TeamEvents.TeamUpdated(activityId, { id: team.id, gar: 'red', status: 'On Assignment' }));
    expect(next.list[0].teams[0].gar).toBe('red');
    expect(next.list[0].teams[0].status).toBe('On Assignment');
  });

  it('StaffUpdated merges the role assignment map', () => {
    let next = apply(stateWithActivity(activityId), TeamEvents.StaffUpdated(activityId, { 'Rescue Group': 'p1' }));
    next = apply(next, TeamEvents.StaffUpdated(activityId, { 'Medical Group': 'p2' }));
    expect(next.list[0].staff).toEqual({ 'Rescue Group': 'p1', 'Medical Group': 'p2' });
  });

  it('ActivityUpdated merges summary fields (create-or-update)', () => {
    const next = apply(stateWithActivity(activityId), ActivityEvents.ActivityUpdated({ id: activityId, isMission: true, asMission: true }));
    expect(next.list[0].isMission).toBe(true);
    expect(next.list[0].asMission).toBe(true);
  });
});
