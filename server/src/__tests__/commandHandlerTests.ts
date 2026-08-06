import { CommsCommands, ParticipantCommands, PlaceCommands } from '@respond/shared/commands';
import { CommsEvents, ParticipantEvents, PlaceEvents } from '@respond/shared/events';
import { createNewActivity, ParticipantStatus } from '@respond/shared/types/activity';
import { createNewPlace } from '@respond/shared/types/operations';

import { produceEvents } from '../commandHandlers';
import { createParticipantTagReactor } from '../reactors/participantTagReactor';
import { placeCommsReactor } from '../reactors/placeCommsReactor';
import { ReactorContext } from '../reactors/reactor';

const activityId = 'a1';
const emptyCtx: ReactorContext = { priorActivities: {}, currentActivities: {} };

describe('produceEvents', () => {
  it('maps CreatePlace -> PlaceCreated', () => {
    const place = createNewPlace('Staging');
    const events = produceEvents(PlaceCommands.CreatePlace(activityId, place));
    expect(events).toEqual([PlaceEvents.PlaceCreated(activityId, place)]);
  });

  it('LogComm mints a full server-authored comm (id + timestamp)', () => {
    const [event] = produceEvents(CommsCommands.LogComm(activityId, { from: 'CP', message: 'radio check', isAutomated: false }));
    expect(CommsEvents.CommLogged.match(event)).toBe(true);
    if (!CommsEvents.CommLogged.match(event)) throw new Error('expected CommLogged');
    expect(event.payload.comm.id).toBeTruthy();
    expect(event.payload.comm.timestamp).toBeGreaterThan(0);
    expect(event.payload.comm.message).toBe('radio check');
  });

  it('maps UpdateParticipant -> ParticipantUpdated', () => {
    const [event] = produceEvents(ParticipantCommands.UpdateParticipant(activityId, 'p1', 'Ann', 'Lee', '1', 100, ParticipantStatus.SignedIn));
    expect(ParticipantEvents.ParticipantUpdated.match(event)).toBe(true);
  });

  it('returns no events for an unknown command', () => {
    expect(produceEvents({ type: 'cmd/bogus', payload: {} } as never)).toEqual([]);
  });
});

describe('participantTagReactor', () => {
  function activityWithParticipant(tags: string[] | undefined) {
    const activity = createNewActivity();
    activity.id = activityId;
    activity.participants = { p1: { id: 'p1', firstname: 'Ann', lastname: 'Lee', organizationId: '1', tags, timeline: [{ time: 1, status: ParticipantStatus.SignedIn, organizationId: '1' }] } };
    return activity;
  }
  const updatedEvent = ParticipantEvents.ParticipantUpdated(activityId, { id: 'p1', firstname: 'Ann', lastname: 'Lee', organizationId: '1' }, { time: 1, status: ParticipantStatus.SignedIn });

  it('emits TagParticipant for a newly-present (untagged) participant', async () => {
    const reactor = createParticipantTagReactor(async () => ['Snow', 'OL']);
    const ctx: ReactorContext = { priorActivities: {}, currentActivities: { [activityId]: activityWithParticipant(undefined) } };
    const commands = await reactor.react(updatedEvent, ctx);
    expect(commands).toHaveLength(1);
    if (!ParticipantCommands.TagParticipant.match(commands[0])) throw new Error('expected TagParticipant');
    expect(commands[0].payload.tags).toEqual(['Snow', 'OL']);
  });

  it('does nothing when the participant is already tagged', async () => {
    const reactor = createParticipantTagReactor(async () => ['Snow']);
    const ctx: ReactorContext = { priorActivities: {}, currentActivities: { [activityId]: activityWithParticipant([]) } };
    expect(await reactor.react(updatedEvent, ctx)).toEqual([]);
  });
});

describe('placeCommsReactor', () => {
  it('emits an established LogComm on PlaceCreated', () => {
    const place = { ...createNewPlace('OP1'), lat: '47.1', lon: '-121.2', notes: 'ridge' };
    const commands = placeCommsReactor.react(PlaceEvents.PlaceCreated(activityId, place), emptyCtx);
    expect(commands).toHaveLength(1);
    expect(CommsCommands.LogComm.match(commands[0])).toBe(true);
    if (!CommsCommands.LogComm.match(commands[0])) throw new Error('expected LogComm');
    expect(commands[0].payload.entry.message).toBe('OP1 established: 47.1, -121.2 ridge');
    expect(commands[0].payload.entry.isAutomated).toBe(true);
  });

  it('emits a terminated LogComm on PlaceDeleted, resolving the name from prior state', () => {
    const place = createNewPlace('OP1');
    const activity = createNewActivity();
    activity.id = activityId;
    activity.places = [place];
    const ctx: ReactorContext = { priorActivities: { [activityId]: activity } };

    const commands = placeCommsReactor.react(PlaceEvents.PlaceDeleted(activityId, place.id), ctx);
    expect(commands).toHaveLength(1);
    if (!CommsCommands.LogComm.match(commands[0])) throw new Error('expected LogComm');
    expect(commands[0].payload.entry.message).toBe('OP1 terminated');
  });

  it('does nothing for a deleted place it cannot resolve', () => {
    expect(placeCommsReactor.react(PlaceEvents.PlaceDeleted(activityId, 'gone'), emptyCtx)).toEqual([]);
  });

  it('ignores comm events (no infinite loop)', () => {
    expect(placeCommsReactor.react(CommsEvents.CommLogged(activityId, { id: 'c1', message: 'x', timestamp: 1 }), emptyCtx)).toEqual([]);
  });
});
