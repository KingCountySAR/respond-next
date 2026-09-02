import { MongoMemoryServer } from 'mongodb-memory-server';
import { v4 as uuid } from 'uuid';

import { ActivityCommands, Command, LocationCommands, ParticipantCommands, PlaceCommands, StampedCommand, TeamCommands } from '@shared/commands';
import { CommsEvents, LocationEvents, ParticipantEvents, PlaceEvents, StampedEvent, TeamEvents, userAuthor } from '@shared/events';
import { OrganizationStatus, ParticipantStatus } from '@shared/types/activity';
import { createNewLocation } from '@shared/types/location';
import { createNewPlace, createNewTeam } from '@shared/types/operations';

import { EventDoc } from '@server/data/eventDoc';

import { createParticipantTagReactor } from '../reactors/participantTagReactor';
import { teamAssignmentReactor } from '../reactors/teamAssignmentReactor';
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

  it('tags a newly signed-in participant via the tagging reactor', async () => {
    // Stub the tag resolver so the reactor does not hit the live member provider.
    const sm = new StateManager([createParticipantTagReactor(async () => ['Snow', 'OL'])]);
    const captured = collect(sm);

    // participantUpdate needs the activity to exist; create it via a place command first.
    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-3', createNewPlace('CP'))), userAuthor('u1'));
    await sm.handleCommand(c(ParticipantCommands.UpdateParticipant('act-3', 'p1', 'Ann', 'Lee', '1', 100, ParticipantStatus.SignedIn)), userAuthor('u1'));

    // Tagging is a fire-and-forget async reactor: it resolves after handleCommand
    // returns, so wait for the deferred work before asserting on tags.
    await sm.settle();

    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-3');
    expect(activity?.participants['p1']?.tags).toEqual(['Snow', 'OL']);

    const types = captured.map((e) => e.type);
    expect(types).toContain(ParticipantEvents.ParticipantUpdated.type);
    expect(types).toContain(ParticipantEvents.ParticipantTagged.type);

    // The tag event is authored by the reactor (service), not the user.
    const tagged = await (await mongoPromise).db().collection<EventDoc>('events').findOne({ activityId: 'act-3', type: ParticipantEvents.ParticipantTagged.type });
    expect(tagged?.meta.author).toEqual({ type: 'service', id: 'participant-tag-reactor' });

    // Async reactor follow-up: uses new commandId and its cause is the triggering event's id.
    const updated = await (await mongoPromise).db().collection<EventDoc>('events').findOne({ activityId: 'act-3', type: ParticipantEvents.ParticipantUpdated.type });
    expect(tagged?.meta.commandId).not.toEqual(updated?.meta.commandId);
    expect(tagged?.meta.cause).toEqual(updated?.id);
  });

  it('assigns a member to a team and flips them to Assigned in one broadcast', async () => {
    const sm = new StateManager([teamAssignmentReactor]);
    const batches = collectBatches(sm);

    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-assign', createNewPlace('CP'))), userAuthor('u1'));
    const team = createNewTeam('Alpha');
    await sm.handleCommand(c(TeamCommands.CreateTeam('act-assign', team)), userAuthor('u1'));
    // The responder arrives at base (Available) before being put on the team.
    await sm.handleCommand(c(ParticipantCommands.UpdateParticipant('act-assign', 'p1', 'Ann', 'Lee', '1', 100, ParticipantStatus.Available)), userAuthor('u1'));

    batches.length = 0; // ignore the setup broadcasts; focus on the assignment
    await sm.handleCommand(c(TeamCommands.AssignTeamMember('act-assign', 'p1', { type: 'team', id: team.id })), userAuthor('u1'));

    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-assign');
    expect(activity?.teams.find((t) => t.id === team.id)?.assignedParticipants).toEqual(['p1']);
    expect(activity?.participants['p1'].timeline[0].status).toBe(ParticipantStatus.Assigned);

    // The assignment and the reactor's status change arrive together, in one broadcast.
    expect(batches).toHaveLength(1);
    expect(batches[0].map((e) => e.type)).toEqual([TeamEvents.TeamMemberAssigned.type, ParticipantEvents.ParticipantTimelineAdded.type]);
  });

  it('disbands a team, cascading member/equipment reassignment and the Available status flip', async () => {
    const sm = new StateManager([teamDisbandReactor, teamAssignmentReactor]);
    const batches = collectBatches(sm);

    const cp = createNewPlace('CP');
    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-disband', cp)), userAuthor('u1'));
    const team = createNewTeam('Alpha');
    await sm.handleCommand(c(TeamCommands.CreateTeam('act-disband', team)), userAuthor('u1'));
    await sm.handleCommand(c(ParticipantCommands.UpdateParticipant('act-disband', 'p1', 'Ann', 'Lee', '1', 100, ParticipantStatus.Available)), userAuthor('u1'));
    await sm.handleCommand(c(TeamCommands.AssignTeamMember('act-disband', 'p1', { type: 'team', id: team.id })), userAuthor('u1'));

    batches.length = 0; // ignore setup broadcasts; focus on the disband
    await sm.handleCommand(c(TeamCommands.DisbandTeam('act-disband', team.id, undefined)), userAuthor('u1'));

    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-disband');
    const disbandedTeam = activity?.teams.find((t) => t.id === team.id);
    expect(disbandedTeam?.status).toBe('Disbanded');
    expect(disbandedTeam?.assignedParticipants).toEqual([]);
    expect(activity?.participants['p1'].timeline[0].status).toBe(ParticipantStatus.Available);

    // TeamDisbanded -> (reactor) TeamMemberAssigned -> (reactor) ParticipantTimelineAdded, all one broadcast.
    expect(batches).toHaveLength(1);
    expect(batches[0].map((e) => e.type)).toEqual([TeamEvents.TeamDisbanded.type, TeamEvents.TeamMemberAssigned.type, ParticipantEvents.ParticipantTimelineAdded.type]);
  });

  it('deletes a team, cascading member/equipment reassignment and the Available status flip', async () => {
    const sm = new StateManager([teamDisbandReactor, teamAssignmentReactor]);
    const batches = collectBatches(sm);

    const cp = createNewPlace('CP');
    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-delete', cp)), userAuthor('u1'));
    const team = createNewTeam('Alpha');
    await sm.handleCommand(c(TeamCommands.CreateTeam('act-delete', team)), userAuthor('u1'));
    await sm.handleCommand(c(ParticipantCommands.UpdateParticipant('act-delete', 'p1', 'Ann', 'Lee', '1', 100, ParticipantStatus.Available)), userAuthor('u1'));
    await sm.handleCommand(c(TeamCommands.AssignTeamMember('act-delete', 'p1', { type: 'team', id: team.id })), userAuthor('u1'));

    batches.length = 0; // ignore setup broadcasts; focus on the delete
    await sm.handleCommand(c(TeamCommands.DeleteTeam('act-delete', team.id, undefined)), userAuthor('u1'));

    const activity = (await sm.getAllActivities()).find((a) => a.id === 'act-delete');
    expect(activity?.teams.some((t) => t.id === team.id)).toBe(false);
    expect(activity?.participants['p1'].timeline[0].status).toBe(ParticipantStatus.Available);

    // TeamDeleted -> (reactor) TeamMemberAssigned -> (reactor) ParticipantTimelineAdded, all one broadcast.
    expect(batches).toHaveLength(1);
    expect(batches[0].map((e) => e.type)).toEqual([TeamEvents.TeamDeleted.type, TeamEvents.TeamMemberAssigned.type, ParticipantEvents.ParticipantTimelineAdded.type]);
  });

  it('logs a team status-change comm via the team-comms reactor', async () => {
    const sm = new StateManager([teamCommsReactor]);
    collect(sm);

    await sm.handleCommand(c(PlaceCommands.CreatePlace('act-4', createNewPlace('CP'))), userAuthor('u1')); // create the activity
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

  it('routes location commands into the locations slice + collection (broadcast to all)', async () => {
    const sm = new StateManager([]);
    const captured = collect(sm);

    const loc = { ...createNewLocation(), id: 'L1', title: 'Trailhead', isSaved: true };
    await sm.handleCommand(c(LocationCommands.UpdateLocation(loc)), userAuthor('u1'));

    expect(sm.getLocationState().list.map((l) => l.title)).toContain('Trailhead');
    // Location events broadcast to all clients (no room scoping).
    const updateBroadcast = captured.find((e) => e.type === LocationEvents.LocationUpdated.type);
    expect(updateBroadcast).toBeTruthy();
    // Persisted to the locations collection.
    expect(await (await mongoPromise).db().collection('locations').findOne({ id: 'L1' })).toBeTruthy();

    await sm.handleCommand(c(LocationCommands.RemoveLocation('L1')), userAuthor('u1'));
    expect(sm.getLocationState().list.find((l) => l.id === 'L1')).toBeUndefined();
    expect(await (await mongoPromise).db().collection('locations').findOne({ id: 'L1' })).toBeNull();
  });
});
