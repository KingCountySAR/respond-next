import { LocationCommands, ParticipantCommands, PlaceCommands, TeamCommands } from '@respond/shared/commands';
import { CommsEvents, LocationEvents, ParticipantEvents, PlaceEvents, StampedEvent, userAuthor } from '@respond/shared/events';
import { ParticipantStatus } from '@respond/shared/types/activity';
import { createNewLocation } from '@respond/shared/types/location';
import { createNewPlace, createNewTeam } from '@respond/shared/types/operations';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { createParticipantTagReactor } from '../reactors/participantTagReactor';
import { teamCommsReactor } from '../reactors/teamCommsReactor';

// StateManager and mongodb are imported dynamically in beforeAll so that
// MONGODB_URI points at the in-memory server before mongodb.ts connects.
type StateManagerCtor = typeof import('../stateManager').StateManager;

let mongod: MongoMemoryServer;
let StateManager: StateManagerCtor;
let mongoPromise: typeof import('../mongodb').default;

function collect(sm: InstanceType<StateManagerCtor>): StampedEvent[] {
  const captured: StampedEvent[] = [];
  sm.addClient({
    broadcastEvent(events) {
      captured.push(...events);
    },
  });
  return captured;
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  StateManager = (await import('../stateManager')).StateManager;
  mongoPromise = (await import('../mongodb')).default;
}, 120000);

afterAll(async () => {
  if (mongoPromise) (await mongoPromise).close();
  if (mongod) await mongod.stop();
});

describe('StateManager.handleCommand', () => {
  it('reduces a place, runs the comms reactor, and writes the audit log', async () => {
    const sm = new StateManager();
    const captured = collect(sm);

    const place = createNewPlace('Staging');
    await sm.handleCommand(PlaceCommands.CreatePlace('act-1', place), userAuthor('u1', 'Tester'));

    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-1');
    expect(activity?.places?.map((p) => p.name)).toContain('Staging');

    // The reactor logged a server-authored "established" comm (has an id it did not get from a client).
    expect(activity?.comms).toHaveLength(1);
    expect(activity?.comms?.[0].message).toContain('established');
    expect(activity?.comms?.[0].id).toBeTruthy();

    // Both facts were broadcast.
    const types = captured.map((e) => e.type);
    expect(types).toEqual([PlaceEvents.PlaceCreated.type, CommsEvents.CommLogged.type]);

    // Audit log: both events persisted, authored by the user and the reactor respectively.
    const evDocs = await (await mongoPromise).db().collection('events').find({ activityId: 'act-1' }).sort({ 'meta.timestamp': 1 }).toArray();
    expect(evDocs).toHaveLength(2);
    expect(evDocs.find((d) => d.type === PlaceEvents.PlaceCreated.type)?.meta.author).toEqual({ type: 'user', id: 'u1', name: 'Tester' });
    expect(evDocs.find((d) => d.type === CommsEvents.CommLogged.type)?.meta.author).toEqual({ type: 'service', id: 'place-comms-reactor' });
  });

  it('deletes a place and logs a terminated comm', async () => {
    const sm = new StateManager();
    collect(sm);

    const place = createNewPlace('OP-2');
    await sm.handleCommand(PlaceCommands.CreatePlace('act-2', place), userAuthor('u1'));
    await sm.handleCommand(PlaceCommands.DeletePlace('act-2', place.id), userAuthor('u1'));

    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-2');
    expect(activity?.places?.some((p) => p.id === place.id)).toBe(false);

    const messages = activity?.comms?.map((c) => c.message) ?? [];
    expect(messages.some((m) => m.includes('established'))).toBe(true);
    expect(messages).toContain('OP-2 terminated');
  });

  it('tags a newly signed-in participant via the tagging reactor', async () => {
    // Stub the tag resolver so the reactor does not hit the live member provider.
    const sm = new StateManager([createParticipantTagReactor(async () => ['Snow', 'OL'])]);
    const captured = collect(sm);

    // participantUpdate needs the activity to exist; create it via a place command first.
    await sm.handleCommand(PlaceCommands.CreatePlace('act-3', createNewPlace('CP')), userAuthor('u1'));
    await sm.handleCommand(ParticipantCommands.UpdateParticipant('act-3', 'p1', 'Ann', 'Lee', '1', 100, ParticipantStatus.SignedIn), userAuthor('u1'));

    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-3');
    expect(activity?.participants['p1']?.tags).toEqual(['Snow', 'OL']);

    const types = captured.map((e) => e.type);
    expect(types).toContain(ParticipantEvents.ParticipantUpdated.type);
    expect(types).toContain(ParticipantEvents.ParticipantTagged.type);

    // The tag event is authored by the reactor (service), not the user.
    const tagged = await (await mongoPromise).db().collection('events').findOne({ activityId: 'act-3', type: ParticipantEvents.ParticipantTagged.type });
    expect(tagged?.meta.author).toEqual({ type: 'service', id: 'participant-tag-reactor' });
  });

  it('logs a team status-change comm via the team-comms reactor', async () => {
    const sm = new StateManager([teamCommsReactor]);
    collect(sm);

    await sm.handleCommand(PlaceCommands.CreatePlace('act-4', createNewPlace('CP')), userAuthor('u1')); // create the activity
    const team = createNewTeam('Alpha');
    await sm.handleCommand(TeamCommands.CreateTeam('act-4', team), userAuthor('u1'));
    // The UI always sends the full team object (pickTeamProperties copies all listed
    // keys, so a partial update would wipe omitted fields).
    await sm.handleCommand(TeamCommands.UpdateTeam('act-4', { ...team, status: 'On Assignment' }), userAuthor('u1'));

    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-4');
    expect(activity?.teams.find((t) => t.id === team.id)?.status).toBe('On Assignment');
    expect(activity?.comms?.map((c) => c.message)).toContain('Starting Assignment');
  });

  it('routes location commands into the locations slice + collection (broadcast to all)', async () => {
    const sm = new StateManager([]);
    const captured = collect(sm);

    const loc = { ...createNewLocation(), id: 'L1', title: 'Trailhead', isSaved: true };
    await sm.handleCommand(LocationCommands.UpdateLocation(loc), userAuthor('u1'));

    expect(sm.getLocationState().list.map((l) => l.title)).toContain('Trailhead');
    // Location events broadcast to all clients (no room scoping).
    const updateBroadcast = captured.find((e) => e.type === LocationEvents.LocationUpdated.type);
    expect(updateBroadcast).toBeTruthy();
    // Persisted to the locations collection.
    expect(await (await mongoPromise).db().collection('locations').findOne({ id: 'L1' })).toBeTruthy();

    await sm.handleCommand(LocationCommands.RemoveLocation('L1'), userAuthor('u1'));
    expect(sm.getLocationState().list.find((l) => l.id === 'L1')).toBeUndefined();
    expect(await (await mongoPromise).db().collection('locations').findOne({ id: 'L1' })).toBeNull();
  });
});
