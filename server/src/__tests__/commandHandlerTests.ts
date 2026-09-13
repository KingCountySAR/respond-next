import { MongoMemoryServer } from 'mongodb-memory-server';

import { ActivityCommands, Commands, CommsCommands, ParticipantCommands, PlaceCommands, ResourceCommands, TeamCommands } from '@shared/commands';
import { ActivityEvents, CommsEvents, ParticipantEvents, PlaceEvents, ResourceEvents, TeamEvents } from '@shared/events';
import { Activity, createNewActivity, ParticipantStatus } from '@shared/types/activity';
import { createNewPlace, createNewTeam, DEFAULT_PLACES } from '@shared/types/operations';

import { participantAssignmentReactor } from '../reactors/participantAssignmentReactor';
import { placeCommsReactor } from '../reactors/placeCommsReactor';
import { ReactorContext } from '../reactors/reactor';
import { teamCommsReactor } from '../reactors/teamCommsReactor';
import { teamDisbandReactor } from '../reactors/teamDisbandedReactor';

const activityId = 'a1';
const emptyCtx: ReactorContext = { priorActivities: {}, currentActivities: {} };

// produceEvents/commandHandlersByType now live in stateManager.ts, which
// imports mongodb.ts (throws at import time without MONGODB_URI) — so, like
// stateManagerCommandTests.ts, import dynamically in beforeAll after pointing
// MONGODB_URI at an in-memory server, even though this suite never touches Mongo.
let mongod: MongoMemoryServer;
let produceEvents: typeof import('../stateManager').produceEvents;
let commandHandlersByType: typeof import('../stateManager').commandHandlersByType;
let mongoPromise: typeof import('../mongodb').default;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  ({ produceEvents, commandHandlersByType } = await import('../stateManager'));
  mongoPromise = (await import('../mongodb')).default;
}, 120000);

afterAll(async () => {
  if (mongoPromise) (await mongoPromise).close();
  if (mongod) await mongod.stop();
});

describe('produceEvents', () => {
  it('every command resolves to a handler (explicit or forwarding .event)', () => {
    const commandTypes = Object.values(Commands)
      .map((c) => c.type)
      .sort();
    const handledTypes = Object.keys(commandHandlersByType)
      .filter((type) => commandHandlersByType[type] !== undefined)
      .sort();
    expect(handledTypes).toEqual(commandTypes);
  });

  it('maps CreatePlace -> PlaceCreated', async () => {
    const place = createNewPlace('Staging');
    const events = await produceEvents(PlaceCommands.CreatePlace(activityId, place));
    expect(events).toEqual([PlaceEvents.PlaceCreated({ activityId, place })]);
  });

  it('LogComm mints a full server-authored comm (id + timestamp)', async () => {
    const [event] = await produceEvents(CommsCommands.LogComm(activityId, { from: DEFAULT_PLACES.base, message: 'radio check', isAutomated: false }));
    expect(CommsEvents.CommLogged.match(event)).toBe(true);
    if (!CommsEvents.CommLogged.match(event)) throw new Error('expected CommLogged');
    expect(event.payload.comm.id).toBeTruthy();
    expect(event.payload.comm.timestamp).toBeGreaterThan(0);
    expect(event.payload.comm.message).toBe('radio check');
  });

  it('maps AddParticipantTimeline -> ParticipantTimelineAdded, resolving org + identity for a brand-new participant', async () => {
    // PREPARE: an activity with no organizations or participants yet, and mock
    // lookups standing in for the Mongo org lookup + member-provider fetch.
    const activity = createNewActivity();
    activity.id = activityId;
    const prior = { [activityId]: activity };
    const services = {
      getOrganization: async (organizationId: string) => ({ id: organizationId, title: 'Org One' }),
      getParticipantInfo: async () => ({ firstname: 'Ann', lastname: 'Lee', tags: ['Snow'] }),
    };

    // TEST: AddParticipantTimeline for a participant/org unknown to this activity.
    const events = await produceEvents(ParticipantCommands.AddParticipantTimeline(activityId, 'p1', { time: 100, status: ParticipantStatus.SignedIn, organizationId: '1' }), prior, services);

    // VERIFY: the org is brought onto the activity first, then the timeline entry carries
    // the resolved identity and tags together (since the participant is new).
    expect(events.map((e) => e.type)).toEqual([ActivityEvents.OrganizationTimelineAppended.type, ParticipantEvents.ParticipantTimelineAdded.type]);
    const [orgAppended, timelineAdded] = events;
    if (!ActivityEvents.OrganizationTimelineAppended.match(orgAppended)) throw new Error('expected OrganizationTimelineAppended');
    expect(orgAppended.payload.org).toEqual({ id: '1', title: 'Org One' });
    if (!ParticipantEvents.ParticipantTimelineAdded.match(timelineAdded)) throw new Error('expected ParticipantTimelineAdded');
    expect(timelineAdded.payload.participant).toEqual({ firstname: 'Ann', lastname: 'Lee', tags: ['Snow'] });
  });

  it('maps DeleteTeam -> TeamDeleted, carrying the chosen target', async () => {
    const target = { type: 'place', id: 'cp' } as const;
    const [event] = await produceEvents(TeamCommands.DeleteTeam(activityId, 'team-1', target));
    expect(event).toEqual(TeamEvents.TeamDeleted({ activityId, id: 'team-1', target }));
  });

  it('maps DisbandTeam -> TeamDisbanded, carrying the chosen target', async () => {
    const target = { type: 'place', id: 'cp' } as const;
    const [event] = await produceEvents(TeamCommands.DisbandTeam(activityId, 'team-1', target));
    expect(event).toEqual(TeamEvents.TeamDisbanded({ activityId, id: 'team-1', target }));
  });

  it('maps AssignParticipant -> ParticipantAssigned (thin: reducer does the move)', async () => {
    const target = { type: 'team', id: 'bravo', asLeader: true } as const;
    const events = await produceEvents(ResourceCommands.AssignParticipant(activityId, 'p1', target));
    expect(events).toEqual([ResourceEvents.ParticipantAssigned({ activityId, participantId: 'p1', target })]);
  });

  it('DecorateOperations -> OperationsDecorated with server-built default operations', async () => {
    const [event] = await produceEvents(ActivityCommands.DecorateOperations(activityId));
    expect(ActivityEvents.OperationsDecorated.match(event)).toBe(true);
    if (!ActivityEvents.OperationsDecorated.match(event)) throw new Error('expected OperationsDecorated');
    const { operations } = event.payload;
    expect(operations.teams).toEqual([]);
    expect(operations.groups).toEqual([]);
    expect(operations.comms).toEqual([]);
    expect(operations.staff).toEqual({});
    // Command Post is the first default place, then Field; server-minted ids.
    expect(operations.places.map((p) => p.name)).toEqual([DEFAULT_PLACES.base, DEFAULT_PLACES.field]);
    expect(operations.places.every((p) => !!p.id)).toBe(true);
  });

  it('returns no events for an unknown command', async () => {
    expect(await produceEvents({ type: 'cmd/bogus', payload: {} } as never)).toEqual([]);
  });
});

describe('AddParticipantTimeline signout rules (priorActivities-driven)', () => {
  // Both orgs pre-seeded so these tests exercise signout chronology only —
  // org-creation-on-first-appearance has its own dedicated test above.
  function activityWith(id: string, timeline?: { id: string; time: number; organizationId: string; status: ParticipantStatus }[]): Activity {
    const activity = createNewActivity();
    activity.id = id;
    activity.organizations = {
      '1': { id: '1', title: 'Org One', timeline: [] },
      '2': { id: '2', title: 'Org Two', timeline: [] },
    };
    activity.participants = {};
    if (timeline) activity.participants.p1 = { id: 'p1', firstname: 'Ann', lastname: 'Lee', organizationId: timeline[0].organizationId, timeline };
    return activity;
  }

  // An org switch re-resolves identity/tags from the member provider, so any
  // test that actually lands a new-org timeline entry needs this.
  const services = {
    getOrganization: async (organizationId: string) => ({ id: organizationId, title: 'Org' }),
    getParticipantInfo: async () => ({ firstname: 'Ann', lastname: 'Lee', tags: ['Rope'] }),
  };

  it('no-ops when org and status are unchanged', async () => {
    // PREPARE: a participant already signed in to org '1'.
    const prior = { [activityId]: activityWith(activityId, [{ id: 'u1', time: 100, organizationId: '1', status: ParticipantStatus.SignedIn }]) };
    // TEST: AddParticipantTimeline with the same org and status, just a later time.
    const events = await produceEvents(ParticipantCommands.AddParticipantTimeline(activityId, 'p1', { time: 200, status: ParticipantStatus.SignedIn, organizationId: '1' }), prior);
    // VERIFY: no timeline entry is recorded — nothing actually changed.
    expect(events).toEqual([]);
  });

  it('switching orgs while active closes out the old org first, then records the new status with refreshed identity/tags', async () => {
    // PREPARE: a participant signed in to org '1'.
    const prior = { [activityId]: activityWith(activityId, [{ id: 'u1', time: 100, organizationId: '1', status: ParticipantStatus.SignedIn }]) };
    // TEST: AddParticipantTimeline switching them to org '2' with a new status.
    const events = await produceEvents(ParticipantCommands.AddParticipantTimeline(activityId, 'p1', { time: 200, status: ParticipantStatus.Available, organizationId: '2' }), prior, services);
    // VERIFY: two timeline entries — the old org's signout first (chronologically earlier), then the
    // new status carrying identity/tags re-resolved for the new org (org-2's tags, not org-1's).
    expect(events).toHaveLength(2);
    if (!ParticipantEvents.ParticipantTimelineAdded.match(events[0])) throw new Error('expected ParticipantTimelineAdded');
    expect(events[0].payload.update).toMatchObject({ organizationId: '1', status: ParticipantStatus.SignedOut, time: 200 });
    expect(events[0].payload.participant).toBeUndefined();
    if (!ParticipantEvents.ParticipantTimelineAdded.match(events[1])) throw new Error('expected ParticipantTimelineAdded');
    expect(events[1].payload.update).toMatchObject({ organizationId: '2', status: ParticipantStatus.Available, time: 200 });
    expect(events[1].payload.participant).toEqual({ firstname: 'Ann', lastname: 'Lee', tags: ['Rope'] });
  });

  it('switching orgs while signing out only records the old-org signout', async () => {
    // PREPARE: a participant signed in to org '1'.
    const prior = { [activityId]: activityWith(activityId, [{ id: 'u1', time: 100, organizationId: '1', status: ParticipantStatus.SignedIn }]) };
    // TEST: AddParticipantTimeline switching to org '2' while signing out entirely.
    const events = await produceEvents(ParticipantCommands.AddParticipantTimeline(activityId, 'p1', { time: 200, status: ParticipantStatus.SignedOut, organizationId: '2' }), prior);
    // VERIFY: only the old-org signout timeline entry is recorded — no entry for org '2'.
    expect(events).toHaveLength(1);
    if (!ParticipantEvents.ParticipantTimelineAdded.match(events[0])) throw new Error('expected ParticipantTimelineAdded');
    expect(events[0].payload.update).toMatchObject({ organizationId: '1', status: ParticipantStatus.SignedOut });
  });

  it('switching orgs from an already-inactive status skips the redundant old-org signout', async () => {
    // PREPARE: a participant already NotResponding (inactive) under org '1'.
    const prior = { [activityId]: activityWith(activityId, [{ id: 'u1', time: 100, organizationId: '1', status: ParticipantStatus.NotResponding }]) };
    // TEST: AddParticipantTimeline switching them to org '2' with an active status.
    const events = await produceEvents(ParticipantCommands.AddParticipantTimeline(activityId, 'p1', { time: 200, status: ParticipantStatus.Available, organizationId: '2' }), prior, services);
    // VERIFY: no redundant old-org signout entry — only the new-org timeline entry, with refreshed identity/tags.
    expect(events).toHaveLength(1);
    if (!ParticipantEvents.ParticipantTimelineAdded.match(events[0])) throw new Error('expected ParticipantTimelineAdded');
    expect(events[0].payload.update).toMatchObject({ organizationId: '2', status: ParticipantStatus.Available });
    expect(events[0].payload.participant).toEqual({ firstname: 'Ann', lastname: 'Lee', tags: ['Rope'] });
  });

  it('signing in here signs the participant out of another activity where they were still signed in', async () => {
    // PREPARE: p1 doesn't exist on this activity yet, but is still SignedIn on another activity (a2).
    // Org '1' is already seeded by activityWith on both, so only the participant needs resolving.
    const prior = {
      [activityId]: activityWith(activityId),
      a2: activityWith('a2', [{ id: 'u2', time: 10, organizationId: '1', status: ParticipantStatus.SignedIn }]),
    };
    const services = {
      getOrganization: async (organizationId: string) => ({ id: organizationId, title: 'Org' }),
      getParticipantInfo: async () => ({ firstname: 'Ann', lastname: 'Lee', tags: [] }),
    };
    // TEST: AddParticipantTimeline signing them in here for the first time.
    const events = await produceEvents(ParticipantCommands.AddParticipantTimeline(activityId, 'p1', { time: 200, status: ParticipantStatus.SignedIn, organizationId: '1' }), prior, services);
    // VERIFY: this activity's timeline entry (carrying the resolved identity + tags, since they're
    // new here), plus a trailing signout timeline entry targeting activity a2.
    expect(events).toHaveLength(2);
    if (!ParticipantEvents.ParticipantTimelineAdded.match(events[0])) throw new Error('expected ParticipantTimelineAdded');
    expect(events[0].payload.participant).toEqual({ firstname: 'Ann', lastname: 'Lee', tags: [] });
    if (!ParticipantEvents.ParticipantTimelineAdded.match(events[1])) throw new Error('expected ParticipantTimelineAdded');
    expect(events[1].payload).toMatchObject({ activityId: 'a2', participantId: 'p1' });
    expect(events[1].payload.update).toMatchObject({ status: ParticipantStatus.SignedOut, organizationId: '1' });
  });

  it('does not sign out of an activity where the participant is allowed to be active elsewhere', async () => {
    // PREPARE: the participant is Available here, but only Standby on a2 (allowed to stay active there).
    const prior = {
      [activityId]: activityWith(activityId, [{ id: 'u1', time: 50, organizationId: '1', status: ParticipantStatus.Available }]),
      a2: activityWith('a2', [{ id: 'u2', time: 10, organizationId: '1', status: ParticipantStatus.Standby }]),
    };
    // TEST: AddParticipantTimeline signing them in here.
    const events = await produceEvents(ParticipantCommands.AddParticipantTimeline(activityId, 'p1', { time: 200, status: ParticipantStatus.SignedIn, organizationId: '1' }), prior);
    // VERIFY: only this activity's timeline entry — no cross-activity signout, since Standby is allowed elsewhere.
    expect(events).toHaveLength(1);
  });
});

describe('CompleteActivity', () => {
  it('signs out every still-active participant ahead of the completion event', async () => {
    // PREPARE: p1 is still SignedIn; p2 is already SignedOut.
    const activity = createNewActivity();
    activity.id = activityId;
    activity.participants = {
      p1: { id: 'p1', firstname: 'Ann', lastname: 'Lee', organizationId: '1', timeline: [{ id: 'u1', time: 50, organizationId: '1', status: ParticipantStatus.SignedIn }] },
      p2: { id: 'p2', firstname: 'Bo', lastname: 'Ng', organizationId: '1', timeline: [{ id: 'u2', time: 50, organizationId: '1', status: ParticipantStatus.SignedOut }] },
    };
    // TEST: CompleteActivity.
    const events = await produceEvents(ActivityCommands.CompleteActivity(activityId, 500), { [activityId]: activity });
    // VERIFY: a timeline signout entry for p1 only (p2 is already out), followed by the completion event.
    expect(events).toHaveLength(2);
    if (!ParticipantEvents.ParticipantTimelineAdded.match(events[0])) throw new Error('expected ParticipantTimelineAdded');
    expect(events[0].payload).toMatchObject({ activityId, participantId: 'p1' });
    expect(events[0].payload.update).toMatchObject({ status: ParticipantStatus.SignedOut, time: 500 });
    expect(ActivityEvents.ActivityCompleted.match(events[1])).toBe(true);
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

    const commands = await teamCommsReactor.react(TeamEvents.TeamUpdated({ activityId, updates: { id: before.teamId, gar: 'red', status: 'On Assignment' } }), ctx);
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

    const [command] = await teamCommsReactor.react(TeamEvents.TeamUpdated({ activityId, updates: { id: before.teamId, status: 'On Scene' } }), ctx);
    if (!CommsCommands.LogComm.match(command)) throw new Error('expected LogComm');
    expect(command.payload.entry.message).toBe('Subject Located');
    expect(command.payload.entry.isFavorite).toBe(true);
  });

  it('emits nothing when neither status nor gar changed', async () => {
    const before = withTeam('green', 'In Base');
    const after = withTeam('green', 'In Base');
    after.activity.teams[0].id = before.teamId;
    const ctx: ReactorContext = { priorActivities: { [activityId]: before.activity }, currentActivities: { [activityId]: after.activity } };
    expect(await teamCommsReactor.react(TeamEvents.TeamUpdated({ activityId, updates: { id: before.teamId, notes: 'x' } }), ctx)).toEqual([]);
  });

  it('logs assign/unassign staff comms with the participant name', async () => {
    const activity = createNewActivity();
    activity.id = activityId;
    activity.participants = { p1: { id: 'p1', firstname: 'Ann', lastname: 'Lee', organizationId: '1', timeline: [] } };
    activity.staff = { 'Rescue Group': 'p1' };
    const prior = createNewActivity();
    prior.id = activityId;
    prior.staff = {};

    const assign = await teamCommsReactor.react(TeamEvents.StaffUpdated({ activityId, staff: { 'Rescue Group': 'p1' } }), { priorActivities: { [activityId]: prior }, currentActivities: { [activityId]: activity } });
    expect(assign.map((c) => (CommsCommands.LogComm.match(c) ? c.payload.entry.message : ''))).toEqual(['Ann Lee assuming Rescue Group']);

    const unassign = await teamCommsReactor.react(TeamEvents.StaffUpdated({ activityId, staff: { 'Rescue Group': '' } }), {
      priorActivities: { [activityId]: activity },
      currentActivities: { [activityId]: { ...activity, staff: { 'Rescue Group': '' } } },
    });
    expect(unassign.map((c) => (CommsCommands.LogComm.match(c) ? c.payload.entry.message : ''))).toEqual(['Rescue Group unassigned']);
  });
});

describe('placeCommsReactor', () => {
  it('emits an established LogComm on PlaceCreated', async () => {
    const place = { ...createNewPlace('OP1'), lat: '47.1', lon: '-121.2', notes: 'ridge' };
    const commands = await placeCommsReactor.react(PlaceEvents.PlaceCreated({ activityId, place }), emptyCtx);
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

    const commands = await placeCommsReactor.react(PlaceEvents.PlaceDeleted({ activityId, placeId: place.id, target: undefined }), ctx);
    expect(commands).toHaveLength(1);
    if (!CommsCommands.LogComm.match(commands[0])) throw new Error('expected LogComm');
    expect(commands[0].payload.entry.message).toBe('OP1 location terminated');
  });

  it('does nothing for a deleted place it cannot resolve', () => {
    expect(placeCommsReactor.react(PlaceEvents.PlaceDeleted({ activityId, placeId: 'gone', target: undefined }), emptyCtx)).toEqual([]);
  });

  it('stays silent for default places (Command Post / Field)', () => {
    expect(placeCommsReactor.react(PlaceEvents.PlaceCreated({ activityId, place: createNewPlace(DEFAULT_PLACES.base) }), emptyCtx)).toEqual([]);
    expect(placeCommsReactor.react(PlaceEvents.PlaceCreated({ activityId, place: createNewPlace(DEFAULT_PLACES.field) }), emptyCtx)).toEqual([]);
  });

  it('ignores comm events (no infinite loop)', () => {
    expect(placeCommsReactor.react(CommsEvents.CommLogged({ activityId, comm: { id: 'c1', message: 'x', timestamp: 1 } }), emptyCtx)).toEqual([]);
  });
});

describe('participantAssignmentReactor', () => {
  // Build an activity where p1 has `status` and (optionally) sits on a team and/or place.
  function activityWith(status: ParticipantStatus, { onTeam = false, onPlace = false }: { onTeam?: boolean; onPlace?: boolean } = {}): Activity {
    const activity = createNewActivity();
    activity.id = activityId;
    activity.participants = { p1: { id: 'p1', firstname: 'Ann', lastname: 'Lee', organizationId: 'o1', timeline: [{ id: 'u1', time: 1, organizationId: 'o1', status }] } };
    activity.teams = [{ ...createNewTeam('Alpha'), id: 'alpha', assignedParticipants: onTeam ? ['p1'] : [] }];
    activity.places = [{ ...createNewPlace('CP'), id: 'cp', assignedParticipants: onPlace ? ['p1'] : [] }];
    return activity;
  }
  const ctxWith = (activity: Activity): ReactorContext => ({ priorActivities: {}, currentActivities: { [activityId]: activity } });
  const assignedToTeam = ResourceEvents.ParticipantAssigned({ activityId, participantId: 'p1', target: { type: 'team', id: 'alpha' } });
  const assignedToPlace = ResourceEvents.ParticipantAssigned({ activityId, participantId: 'p1', target: { type: 'place', id: 'cp' } });

  it('flips an Available responder to Assigned when they land on a team', async () => {
    // PREPARE: p1 is Available and already assigned to a team (per activityWith's onTeam flag).
    // TEST: react to the ParticipantAssigned event that put them there.
    const [command] = await participantAssignmentReactor.react(assignedToTeam, ctxWith(activityWith(ParticipantStatus.Available, { onTeam: true })));
    // VERIFY: an AddParticipantTimeline command flips them to Assigned, keeping their current org.
    if (!ParticipantCommands.AddParticipantTimeline.match(command)) throw new Error('expected AddParticipantTimeline');
    expect(command.payload.update.status).toBe(ParticipantStatus.Assigned);
    expect(command.payload.update.organizationId).toBe('o1');
  });

  it('flips an Available responder to Assigned when they land on a place', async () => {
    // PREPARE: p1 is Available and already assigned to a place.
    // TEST: react to the ParticipantAssigned event that put them there.
    const [command] = await participantAssignmentReactor.react(assignedToPlace, ctxWith(activityWith(ParticipantStatus.Available, { onPlace: true })));
    // VERIFY: an AddParticipantTimeline command flips them to Assigned.
    if (!ParticipantCommands.AddParticipantTimeline.match(command)) throw new Error('expected AddParticipantTimeline');
    expect(command.payload.update.status).toBe(ParticipantStatus.Assigned);
  });

  it('flips an Assigned responder to Available when they leave every team and place', async () => {
    // PREPARE: p1 is Assigned but not currently on any team or place.
    // TEST: react to a ParticipantAssigned event with no target (unassigned).
    const [command] = await participantAssignmentReactor.react(ResourceEvents.ParticipantAssigned({ activityId, participantId: 'p1', target: undefined }), ctxWith(activityWith(ParticipantStatus.Assigned)));
    // VERIFY: an AddParticipantTimeline command flips them back to Available.
    if (!ParticipantCommands.AddParticipantTimeline.match(command)) throw new Error('expected AddParticipantTimeline');
    expect(command.payload.update.status).toBe(ParticipantStatus.Available);
  });

  it('leaves an already-Assigned member alone on a team→place move (still assigned)', async () => {
    // PREPARE: p1 is already Assigned and lands on a place (moving between assignments).
    // TEST: react to the ParticipantAssigned event for that move.
    // VERIFY: no timeline command is emitted — their status doesn't need to change.
    expect(await participantAssignmentReactor.react(assignedToPlace, ctxWith(activityWith(ParticipantStatus.Assigned, { onPlace: true })))).toEqual([]);
  });

  it('does not override a non-checked-in status (e.g. SignedIn)', async () => {
    // PREPARE: p1 is SignedIn (not Available/Assigned) and lands on a team.
    // TEST: react to the ParticipantAssigned event for that move.
    // VERIFY: no timeline command is emitted — SignedIn isn't a status this reactor manages.
    expect(await participantAssignmentReactor.react(assignedToTeam, ctxWith(activityWith(ParticipantStatus.SignedIn, { onTeam: true })))).toEqual([]);
  });

  it('ignores unrelated events', async () => {
    expect(await participantAssignmentReactor.react(TeamEvents.TeamCreated({ activityId, team: createNewTeam('Bravo') }), emptyCtx)).toEqual([]);
  });
});

describe('teamDisbandReactor', () => {
  function activityWithDisbandedTeam({ onPlace = false }: { onPlace?: boolean } = {}) {
    const activity = createNewActivity();
    activity.id = activityId;
    const equipment = { id: 'e1', uuid: 'eq1', name: 'Radio 1', type: 'radio' };
    const team = { ...createNewTeam('Alpha'), id: 'alpha', status: 'Disbanded' as const, assignedParticipants: ['p1'], assignedEquipment: [equipment] };
    activity.teams = [team];
    activity.places = onPlace ? [{ ...createNewPlace('CP'), id: 'cp' }] : [];
    return { activity, equipment };
  }
  // The reactor reads from `priorActivities`: correct for TeamDisbanded
  // (reducer leaves the team in place) and required for TeamDeleted (reducer
  // removes the team, so only `prior` still has it).
  const ctxWith = (activity: Activity): ReactorContext => ({ priorActivities: { [activityId]: activity }, currentActivities: {} });

  it('reassigns every member and equipment item to the given target', async () => {
    const { activity, equipment } = activityWithDisbandedTeam({ onPlace: true });
    const target = { type: 'place', id: 'cp' } as const;
    const commands = await teamDisbandReactor.react(TeamEvents.TeamDisbanded({ activityId, id: 'alpha', target }), ctxWith(activity));

    expect(commands).toEqual([ResourceCommands.AssignParticipant(activityId, 'p1', target), ResourceCommands.AssignEquipment(activityId, equipment, target)]);
  });

  it('reassigns to nowhere (available pool) when no target is given', async () => {
    const { activity, equipment } = activityWithDisbandedTeam();
    const commands = await teamDisbandReactor.react(TeamEvents.TeamDisbanded({ activityId, id: 'alpha', target: undefined }), ctxWith(activity));

    expect(commands).toEqual([ResourceCommands.AssignParticipant(activityId, 'p1', undefined), ResourceCommands.AssignEquipment(activityId, equipment, undefined)]);
  });

  it('does the same for TeamDeleted, since the deleted team only survives in priorActivities', async () => {
    const { activity, equipment } = activityWithDisbandedTeam({ onPlace: true });
    const target = { type: 'place', id: 'cp' } as const;
    const commands = await teamDisbandReactor.react(TeamEvents.TeamDeleted({ activityId, id: 'alpha', target }), ctxWith(activity));

    expect(commands).toEqual([ResourceCommands.AssignParticipant(activityId, 'p1', target), ResourceCommands.AssignEquipment(activityId, equipment, target)]);
  });

  it('does nothing for a team it cannot resolve', () => {
    expect(teamDisbandReactor.react(TeamEvents.TeamDisbanded({ activityId, id: 'gone', target: undefined }), emptyCtx)).toEqual([]);
  });

  it('ignores unrelated events', () => {
    expect(teamDisbandReactor.react(TeamEvents.TeamCreated({ activityId, team: createNewTeam('Bravo') }), emptyCtx)).toEqual([]);
  });
});
