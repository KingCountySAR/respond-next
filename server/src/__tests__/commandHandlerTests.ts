import { CommsCommands, LocationCommands, ParticipantCommands, PlaceCommands } from '@shared/commands';
import { CommsEvents, LocationEvents, ParticipantEvents, PlaceEvents, TeamEvents } from '@shared/events';
import { createNewActivity, ParticipantStatus } from '@shared/types/activity';
import { createNewPlace, createNewTeam } from '@shared/types/operations';

import { produceEvents } from '../commandHandlers';
import { createParticipantTagReactor } from '../reactors/participantTagReactor';
import { placeCommsReactor } from '../reactors/placeCommsReactor';
import { ReactorContext } from '../reactors/reactor';
import { teamCommsReactor } from '../reactors/teamCommsReactor';

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

  it('maps location commands -> location events', () => {
    expect(LocationEvents.LocationUpdated.match(produceEvents(LocationCommands.UpdateLocation({ id: 'L1', title: 'x' }))[0])).toBe(true);
    expect(LocationEvents.LocationRemoved.match(produceEvents(LocationCommands.RemoveLocation('L1'))[0])).toBe(true);
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

describe('teamCommsReactor', () => {
  function withTeam(gar: 'green' | 'amber' | 'red', status: 'In Base' | 'On Assignment') {
    const activity = createNewActivity();
    activity.id = activityId;
    const team = { ...createNewTeam('Alpha'), gar, status } as const;
    activity.teams = [team];
    return { activity, teamId: team.id };
  }

  it('logs a status comm and a GAR comm when both change', async () => {
    const before = withTeam('green', 'In Base');
    const after = withTeam('red', 'On Assignment');
    after.activity.teams[0].id = before.teamId; // same team id across snapshots
    const ctx: ReactorContext = { priorActivities: { [activityId]: before.activity }, currentActivities: { [activityId]: after.activity } };

    const commands = await teamCommsReactor.react(TeamEvents.TeamUpdated(activityId, { id: before.teamId, gar: 'red', status: 'On Assignment' }), ctx);
    const messages = commands.map((c) => (CommsCommands.LogComm.match(c) ? c.payload.entry.message : ''));
    expect(messages).toContain('Starting Assignment');
    expect(messages).toContain('Alpha GAR changed to RED');
    // GAR comm is favorited when not green
    const garComm = commands.find((c) => CommsCommands.LogComm.match(c) && c.payload.entry.message.includes('GAR'));
    expect(garComm && CommsCommands.LogComm.match(garComm) && garComm.payload.entry.isFavorite).toBe(true);
  });

  it('logs "Subject Located" (favorited) for the first team to reach On Scene', async () => {
    const before = withTeam('green', 'In Base');
    const after = withTeam('green', 'On Assignment');
    after.activity.teams[0].id = before.teamId;
    after.activity.teams[0].status = 'On Scene'; // first (only) team on scene
    const ctx: ReactorContext = { priorActivities: { [activityId]: before.activity }, currentActivities: { [activityId]: after.activity } };

    const [command] = await teamCommsReactor.react(TeamEvents.TeamUpdated(activityId, { id: before.teamId, status: 'On Scene' }), ctx);
    if (!CommsCommands.LogComm.match(command)) throw new Error('expected LogComm');
    expect(command.payload.entry.message).toBe('Subject Located');
    expect(command.payload.entry.isFavorite).toBe(true);
  });

  it('emits nothing when neither status nor gar changed', async () => {
    const before = withTeam('green', 'In Base');
    const after = withTeam('green', 'In Base');
    after.activity.teams[0].id = before.teamId;
    const ctx: ReactorContext = { priorActivities: { [activityId]: before.activity }, currentActivities: { [activityId]: after.activity } };
    expect(await teamCommsReactor.react(TeamEvents.TeamUpdated(activityId, { id: before.teamId, notes: 'x' }), ctx)).toEqual([]);
  });

  it('logs assign/unassign staff comms with the participant name', async () => {
    const activity = createNewActivity();
    activity.id = activityId;
    activity.participants = { p1: { id: 'p1', firstname: 'Ann', lastname: 'Lee', organizationId: '1', timeline: [] } };
    activity.staff = { 'Rescue Group': 'p1' };
    const prior = createNewActivity();
    prior.id = activityId;
    prior.staff = {};

    const assign = await teamCommsReactor.react(TeamEvents.StaffUpdated(activityId, { 'Rescue Group': 'p1' }), { priorActivities: { [activityId]: prior }, currentActivities: { [activityId]: activity } });
    expect(assign.map((c) => (CommsCommands.LogComm.match(c) ? c.payload.entry.message : ''))).toEqual(['Ann Lee assuming Rescue Group']);

    const unassign = await teamCommsReactor.react(TeamEvents.StaffUpdated(activityId, { 'Rescue Group': '' }), {
      priorActivities: { [activityId]: activity },
      currentActivities: { [activityId]: { ...activity, staff: { 'Rescue Group': '' } } },
    });
    expect(unassign.map((c) => (CommsCommands.LogComm.match(c) ? c.payload.entry.message : ''))).toEqual(['Rescue Group unassigned']);
  });
});

describe('placeCommsReactor', () => {
  it('emits an established LogComm on PlaceCreated', async () => {
    const place = { ...createNewPlace('OP1'), lat: '47.1', lon: '-121.2', notes: 'ridge' };
    const commands = await placeCommsReactor.react(PlaceEvents.PlaceCreated(activityId, place), emptyCtx);
    expect(commands).toHaveLength(1);
    expect(CommsCommands.LogComm.match(commands[0])).toBe(true);
    if (!CommsCommands.LogComm.match(commands[0])) throw new Error('expected LogComm');
    expect(commands[0].payload.entry.message).toBe('OP1 established 47.1, -121.2 ridge');
    expect(commands[0].payload.entry.isAutomated).toBe(true);
  });

  it('emits a terminated LogComm on PlaceDeleted, resolving the name from prior state', async () => {
    const place = createNewPlace('OP1');
    const activity = createNewActivity();
    activity.id = activityId;
    activity.places = [place];
    const ctx: ReactorContext = { priorActivities: { [activityId]: activity }, currentActivities: {} };

    const commands = await placeCommsReactor.react(PlaceEvents.PlaceDeleted(activityId, place.id), ctx);
    expect(commands).toHaveLength(1);
    if (!CommsCommands.LogComm.match(commands[0])) throw new Error('expected LogComm');
    expect(commands[0].payload.entry.message).toBe('OP1 location terminated');
  });

  it('does nothing for a deleted place it cannot resolve', () => {
    expect(placeCommsReactor.react(PlaceEvents.PlaceDeleted(activityId, 'gone'), emptyCtx)).toEqual([]);
  });

  it('stays silent for default places (Command Post / Field)', () => {
    expect(placeCommsReactor.react(PlaceEvents.PlaceCreated(activityId, createNewPlace('Command Post')), emptyCtx)).toEqual([]);
    expect(placeCommsReactor.react(PlaceEvents.PlaceCreated(activityId, createNewPlace('Field (Unassigned)')), emptyCtx)).toEqual([]);
  });

  it('ignores comm events (no infinite loop)', () => {
    expect(placeCommsReactor.react(CommsEvents.CommLogged(activityId, { id: 'c1', message: 'x', timestamp: 1 }), emptyCtx)).toEqual([]);
  });
});
