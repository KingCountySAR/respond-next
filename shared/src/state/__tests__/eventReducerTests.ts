import { produce } from 'immer';

import { CommsEvents, ParticipantEvents, PlaceEvents } from '../../events';
import { createNewActivity, ParticipantStatus } from '../../types/activity';
import { CommunicationsLogEntry, createNewPlace } from '../../types/operations';

import { ActivityState } from '..';
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

  it('CommLogged is idempotent on replay (same id applied twice)', () => {
    const comm: CommunicationsLogEntry = { id: 'srv-1', from: 'CP', message: 'once', timestamp: 111 };
    let next = apply(stateWithActivity(activityId), CommsEvents.CommLogged(activityId, comm));
    next = apply(next, CommsEvents.CommLogged(activityId, comm));
    expect(next.list[0].comms).toHaveLength(1);
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
});
