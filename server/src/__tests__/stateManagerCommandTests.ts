import { MongoMemoryServer } from 'mongodb-memory-server';

import { PlaceCommands } from '@respond/shared/commands';
import { CommsEvents, PlaceEvents, StampedEvent, userAuthor } from '@respond/shared/events';
import { createNewPlace } from '@respond/shared/types/operations';

// StateManager and mongodb are imported dynamically in beforeAll so that
// MONGODB_URI points at the in-memory server before mongodb.ts connects.
type StateManagerCtor = typeof import('../stateManager').StateManager;

let mongod: MongoMemoryServer;
let StateManager: StateManagerCtor;
let mongoPromise: typeof import('../mongodb').default;

function collect(sm: InstanceType<StateManagerCtor>): StampedEvent[] {
  const captured: StampedEvent[] = [];
  sm.addClient({
    broadcastAction() {},
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
});
