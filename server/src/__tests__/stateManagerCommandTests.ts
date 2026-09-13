import { MongoMemoryServer } from 'mongodb-memory-server';
import { v4 as uuid } from 'uuid';

import { ActivityCommands, Command, CommandError, ParticipantCommands, PlaceCommands, ResourceCommands, StampedCommand, TeamCommands } from '@shared/commands';
import { CommsEvents, ParticipantEvents, PlaceEvents, ResourceEvents, StampedEvent, TeamEvents, userAuthor } from '@shared/events';
import { OrganizationStatus, ParticipantStatus } from '@shared/types/activity';
import { createNewPlace, createNewTeam } from '@shared/types/operations';

import { EventDoc } from '@server/data/eventDoc';

import { CommandServices } from '../commands';
import { participantAssignmentReactor } from '../reactors/participantAssignmentReactor';
import { Reactor } from '../reactors/reactor';
import { teamCommsReactor } from '../reactors/teamCommsReactor';
import { teamDisbandReactor } from '../reactors/teamDisbandedReactor';

// StateManager and mongodb are imported dynamically in beforeAll so that
// MONGODB_URI points at the in-memory server before mongodb.ts connects.
type StateManagerCtor = typeof import('../stateManager').StateManager;

let mongod: MongoMemoryServer;
let StateManager: StateManagerCtor;
let mongoPromise: typeof import('../mongodb').default;

function c(command: Command): StampedCommand {
  return { ...command, id: uuid() };
}

/** Mock org/participant lookups for tests whose AddParticipantTimeline calls create a brand-new participant. */
function testServices(overrides: Partial<CommandServices> = {}): CommandServices {
  return {
    getOrganization: async (organizationId) => ({ id: organizationId, title: 'Org One' }),
    getParticipantInfo: async () => ({ firstname: 'Ann', lastname: 'Lee', tags: [] }),
    ...overrides,
  };
}

async function createActivity(sm: InstanceType<StateManagerCtor>, id: string): Promise<void> {
  await sm.handleCommand(c(ActivityCommands.UpdateActivity({ id, title: 'Test Activity' })), userAuthor('u1'));
}

function collect(sm: InstanceType<StateManagerCtor>): StampedEvent[] {
  const captured: StampedEvent[] = [];
  sm.addClient({
    broadcastEvent(events) {
      captured.push(...events);
    },
  });
  return captured;
}

/** Capture each broadcast as its own batch (to assert how many broadcasts a command made). */
function collectBatches(sm: InstanceType<StateManagerCtor>): StampedEvent[][] {
  const batches: StampedEvent[][] = [];
  sm.addClient({
    broadcastEvent(events) {
      batches.push(events);
    },
  });
  return batches;
}

/** Capture each broadcast along with the rooms it was addressed to. */
function collectWithRooms(sm: InstanceType<StateManagerCtor>): { events: StampedEvent[]; toRooms: string[] | undefined }[] {
  const batches: { events: StampedEvent[]; toRooms: string[] | undefined }[] = [];
  sm.addClient({
    broadcastEvent(events, toRooms) {
      batches.push({ events, toRooms });
    },
  });
  return batches;
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
    await createActivity(sm, 'act-1');
    const captured = collect(sm);

    const place = createNewPlace('Staging');
    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-1', place)), userAuthor('u1', 'Tester'));

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
    const evDocs = await (await mongoPromise).db().collection<EventDoc>('events').find({ activityId: 'act-1' }).sort({ 'meta.timestamp': 1 }).toArray();
    expect(evDocs).toHaveLength(2);
    expect(evDocs.find((d) => d.type === PlaceEvents.PlaceCreated.type)?.meta.author).toEqual({ type: 'user', id: 'u1', name: 'Tester' });
    expect(evDocs.find((d) => d.type === CommsEvents.CommLogged.type)?.meta.author).toEqual({ type: 'service', id: 'place-comms-reactor' });

    // id/commandId/cause: root and reactor follow-up have unique ids but share
    // one commandId; only the follow-up records a cause, pointing at the root.
    const root = evDocs.find((d) => d.type === PlaceEvents.PlaceCreated.type)!;
    const followup = evDocs.find((d) => d.type === CommsEvents.CommLogged.type)!;
    expect(root.id).toBeTruthy();
    expect(followup.id).toBeTruthy();
    expect(root.id).not.toEqual(followup.id);
    expect(followup.meta.commandId).toEqual(root.meta.commandId);
    expect(root.meta.cause).toBeUndefined();
    expect(followup.meta.cause).toEqual(root.id);
  });

  it('collapses a command and its sync reactor into a single broadcast', async () => {
    const sm = new StateManager();
    await createActivity(sm, 'act-collapse');
    const batches = collectBatches(sm);

    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-collapse', createNewPlace('Staging'))), userAuthor('u1'));

    // Exactly one broadcast carrying both the command's event and the reactor's.
    expect(batches).toHaveLength(1);
    expect(batches[0].map((e) => e.type)).toEqual([PlaceEvents.PlaceCreated.type, CommsEvents.CommLogged.type]);

    // Both events landed in the audit log — written by a single insertMany, not
    // a second reactor round-trip.
    const evDocs = await (await mongoPromise).db().collection<EventDoc>('events').find({ activityId: 'act-collapse' }).toArray();
    expect(evDocs).toHaveLength(2);
  });

  it('deletes a place and logs a terminated comm', async () => {
    const sm = new StateManager();
    await createActivity(sm, 'act-2');
    collect(sm);

    const place = createNewPlace('OP-2');
    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-2', place)), userAuthor('u1'));
    await sm.handleCommand(c(PlaceCommands.DeletePlace('act-2', place.id)), userAuthor('u1'));

    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-2');
    expect(activity?.places?.some((p) => p.id === place.id)).toBe(false);

    const messages = activity?.comms?.map((c) => c.message) ?? [];
    expect(messages.some((m) => m.includes('established'))).toBe(true);
    expect(messages).toContain('OP-2 location terminated');
  });

  it('tags a newly-present participant in the same event as their first timeline entry', async () => {
    // PREPARE: an activity with no participants yet, and a participant-info lookup that returns tags.
    const sm = new StateManager([], testServices({ getParticipantInfo: async () => ({ firstname: 'Ann', lastname: 'Lee', tags: ['Snow', 'OL'] }) }));
    await createActivity(sm, 'act-3');
    const captured = collect(sm);

    // TEST: AddParticipantTimeline for a participant unknown to this activity.
    await sm.handleCommand(c(ParticipantCommands.AddParticipantTimeline('act-3', 'p1', { organizationId: '1', status: ParticipantStatus.SignedIn, time: 200 })), userAuthor('u1'));

    // VERIFY: the participant is created with the resolved tags, via a single ParticipantTimelineAdded event.
    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-3');
    expect(activity?.participants['p1']?.tags).toEqual(['Snow', 'OL']);

    const types = captured.map((e) => e.type);
    expect(types).toContain(ParticipantEvents.ParticipantTimelineAdded.type);

    const added = await (await mongoPromise).db().collection<EventDoc>('events').findOne({ activityId: 'act-3', type: ParticipantEvents.ParticipantTimelineAdded.type });
    expect(added?.meta.author).toMatchObject({ type: 'user', id: 'u1' });
  });

  it('assigns a member to a team and flips them to Assigned in one broadcast', async () => {
    // PREPARE: an activity with a place, a team, and a participant already Available.
    const sm = new StateManager([participantAssignmentReactor], testServices());
    await createActivity(sm, 'act-assign');
    const batches = collectBatches(sm);

    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-assign', createNewPlace('CP'))), userAuthor('u1'));
    const team = createNewTeam('Alpha');
    await sm.handleCommand(c(TeamCommands.CreateTeam('act-assign', team)), userAuthor('u1'));
    // The responder arrives at base (Available) before being put on the team.
    await sm.handleCommand(c(ParticipantCommands.AddParticipantTimeline('act-assign', 'p1', { time: 100, status: ParticipantStatus.Available, organizationId: '1' })), userAuthor('u1'));

    batches.length = 0; // ignore the setup broadcasts; focus on the assignment
    // TEST: assign that participant to the team.
    await sm.handleCommand(c(ResourceCommands.AssignParticipant('act-assign', 'p1', { type: 'team', id: team.id })), userAuthor('u1'));

    // VERIFY: the team roster updates, and the participantAssignmentReactor's follow-up
    // timeline entry flips their status to Assigned — all in one broadcast.
    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-assign');
    expect(activity?.teams.find((t) => t.id === team.id)?.assignedParticipants).toEqual(['p1']);
    expect(activity?.participants['p1'].timeline[0].status).toBe(ParticipantStatus.Assigned);

    // The assignment and the reactor's status change arrive together, in one broadcast.
    expect(batches).toHaveLength(1);
    expect(batches[0].map((e) => e.type)).toEqual([ResourceEvents.ParticipantAssigned.type, ParticipantEvents.ParticipantTimelineAdded.type]);
  });

  it('disbands a team, cascading member/equipment reassignment and the Available status flip', async () => {
    // PREPARE: an activity with a team holding one Assigned member.
    const sm = new StateManager([teamDisbandReactor, participantAssignmentReactor], testServices());
    await createActivity(sm, 'act-disband');
    const batches = collectBatches(sm);

    const cp = createNewPlace('CP');
    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-disband', cp)), userAuthor('u1'));
    const team = createNewTeam('Alpha');
    await sm.handleCommand(c(TeamCommands.CreateTeam('act-disband', team)), userAuthor('u1'));
    await sm.handleCommand(c(ParticipantCommands.AddParticipantTimeline('act-disband', 'p1', { time: 100, status: ParticipantStatus.Available, organizationId: '1' })), userAuthor('u1'));
    await sm.handleCommand(c(ResourceCommands.AssignParticipant('act-disband', 'p1', { type: 'team', id: team.id })), userAuthor('u1'));

    batches.length = 0; // ignore setup broadcasts; focus on the disband
    // TEST: disband the team.
    await sm.handleCommand(c(TeamCommands.DisbandTeam('act-disband', team.id)), userAuthor('u1'));

    // VERIFY: the team is marked Disbanded and cleared, and the cascading
    // reassignment's follow-up timeline entry flips the member back to Available.
    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-disband');
    const disbandedTeam = activity?.teams.find((t) => t.id === team.id);
    expect(disbandedTeam?.status).toBe('Disbanded');
    expect(disbandedTeam?.assignedParticipants).toEqual([]);
    expect(activity?.participants['p1'].timeline[0].status).toBe(ParticipantStatus.Available);

    // TeamDisbanded -> (reactor) ParticipantAssigned -> (reactor) ParticipantTimelineAdded, all one broadcast.
    expect(batches).toHaveLength(1);
    expect(batches[0].map((e) => e.type)).toEqual([TeamEvents.TeamDisbanded.type, ResourceEvents.ParticipantAssigned.type, ParticipantEvents.ParticipantTimelineAdded.type]);
  });

  it('deletes a team, cascading member/equipment reassignment and the Available status flip', async () => {
    // PREPARE: an activity with a team holding one Assigned member.
    const sm = new StateManager([teamDisbandReactor, participantAssignmentReactor], testServices());
    await createActivity(sm, 'act-delete');
    const batches = collectBatches(sm);

    const cp = createNewPlace('CP');
    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-delete', cp)), userAuthor('u1'));
    const team = createNewTeam('Alpha');
    await sm.handleCommand(c(TeamCommands.CreateTeam('act-delete', team)), userAuthor('u1'));
    await sm.handleCommand(c(ParticipantCommands.AddParticipantTimeline('act-delete', 'p1', { time: 100, status: ParticipantStatus.Available, organizationId: '1' })), userAuthor('u1'));
    await sm.handleCommand(c(ResourceCommands.AssignParticipant('act-delete', 'p1', { type: 'team', id: team.id })), userAuthor('u1'));

    batches.length = 0; // ignore setup broadcasts; focus on the delete
    // TEST: delete the team.
    await sm.handleCommand(c(TeamCommands.DeleteTeam('act-delete', team.id)), userAuthor('u1'));

    // VERIFY: the team is gone, and the cascading reassignment's follow-up
    // timeline entry flips the member back to Available.
    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-delete');
    expect(activity?.teams.some((t) => t.id === team.id)).toBe(false);
    expect(activity?.participants['p1'].timeline[0].status).toBe(ParticipantStatus.Available);

    // TeamDeleted -> (reactor) ParticipantAssigned -> (reactor) ParticipantTimelineAdded, all one broadcast.
    expect(batches).toHaveLength(1);
    expect(batches[0].map((e) => e.type)).toEqual([TeamEvents.TeamDeleted.type, ResourceEvents.ParticipantAssigned.type, ParticipantEvents.ParticipantTimelineAdded.type]);
  });

  it('logs a team status-change comm via the team-comms reactor', async () => {
    const sm = new StateManager([teamCommsReactor]);
    await createActivity(sm, 'act-4');
    collect(sm);

    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-4', createNewPlace('CP'))), userAuthor('u1'));
    const team = createNewTeam('Alpha');
    await sm.handleCommand(c(TeamCommands.CreateTeam('act-4', team)), userAuthor('u1'));
    // The UI always sends the full team object (pickTeamProperties copies all listed
    // keys, so a partial update would wipe omitted fields).
    await sm.handleCommand(c(TeamCommands.UpdateTeam('act-4', { ...team, status: 'On Assignment' })), userAuthor('u1'));

    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-4');
    expect(activity?.teams.find((t) => t.id === team.id)?.status).toBe('On Assignment');
    expect(activity?.comms?.map((c) => c.message)).toContain('Starting Assignment');
  });

  it('does not lose a newly-created activity when commands race (unawaited, fired back-to-back)', async () => {
    // Regression test: creating a new activity via UpdateActivity followed
    // immediately by AppendOrganizationTimeline (as ActivityEditPage does, both
    // dispatched in the same synchronous tick) used to race — handleCommand
    // snapshotted `this.activityState` before its own awaits and wrote it back
    // unconditionally afterward, so the second command's stale (pre-creation)
    // snapshot could clobber the first command's newly-created activity out of
    // memory (Mongo stayed correct; only the in-memory copy was corrupted).
    const sm = new StateManager([]);

    const updatePromise = sm.handleCommand(c(ActivityCommands.UpdateActivity({ id: 'act-race', title: 'New Mission' })), userAuthor('u1'));
    const appendPromise = sm.handleCommand(c(ActivityCommands.AppendOrganizationTimeline('act-race', { id: 'org-1', title: 'Org One' }, { time: Date.now(), status: OrganizationStatus.Responding })), userAuthor('u1'));
    await Promise.all([updatePromise, appendPromise]);

    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-race');
    expect(activity).toBeTruthy();
    expect(activity?.title).toBe('New Mission');
    expect(activity?.organizations['org-1']).toBeTruthy();
  });
});

describe('StateManager error handling', () => {
  // StateManager has no notion of sockets/clients — a thrown CommandError (or
  // any other error) from a handler or sync reactor just rejects
  // handleCommand's promise, with nothing from the batch committed. Turning
  // that rejection into a reply for the right client is socketManager.ts's
  // job (see its 'command' handler), not tested here.

  it('rejects with the thrown CommandError and commits nothing', async () => {
    const throwingOnPlaceCreated: Reactor = {
      name: 'throwing-reactor',
      react(event) {
        if (!PlaceEvents.PlaceCreated.match(event)) return [];
        throw new CommandError('No room at the inn', 'NO_ROOM');
      },
    };
    const sm = new StateManager([throwingOnPlaceCreated]);
    await createActivity(sm, 'act-err');
    const batches = collectWithRooms(sm);

    await expect(sm.handleCommand(c(PlaceCommands.CreatePlace('act-err', createNewPlace('CP'))), userAuthor('u1'))).rejects.toThrow('No room at the inn');

    expect(batches).toHaveLength(0);
    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-err');
    expect(activity?.places?.some((p) => p.name === 'CP')).toBe(false);
    const evDocs = await (await mongoPromise).db().collection<EventDoc>('events').find({ activityId: 'act-err', type: PlaceEvents.PlaceCreated.type }).toArray();
    expect(evDocs).toHaveLength(0);
  });

  it('rejects with a plain Error from a reactor just as readily, still committing nothing', async () => {
    const boomReactor: Reactor = {
      name: 'boom-reactor',
      react(event) {
        if (!PlaceEvents.PlaceCreated.match(event)) return [];
        throw new Error('something internal broke');
      },
    };
    const sm = new StateManager([boomReactor]);
    await createActivity(sm, 'act-err2');
    const batches = collectWithRooms(sm);

    await expect(sm.handleCommand(c(PlaceCommands.CreatePlace('act-err2', createNewPlace('CP'))), userAuthor('u1'))).rejects.toThrow('something internal broke');

    expect(batches).toHaveLength(0);
    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-err2');
    expect(activity?.places?.some((p) => p.name === 'CP')).toBe(false);
  });
});
