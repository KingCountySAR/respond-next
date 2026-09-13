import { v4 as uuid } from 'uuid';

import { ActivityCommands, CommandError, CommsCommands, ParticipantCommands } from '@shared/commands';
import { ActivityEvents, CommsEvents, DomainEvent, ParticipantEvents } from '@shared/events';
import { Activity, OrganizationStatus, PARTICIPANT_STATUS_ALLOWED_WHILE_ACTIVE_ELSEWHERE, ParticipantStatus, ParticipantUpdate } from '@shared/types/activity';
import { OrganizationDoc, ORGS_COLLECTION } from '@shared/types/data/organizationDoc';
import { createDefaultOperations, createNewCommsEntry } from '@shared/types/operations';

import mongoPromise from './mongodb';
import { getServices } from './services';

// A command handler can return several events in one go (e.g. a status change
// plus the auto-signouts it triggers). `causedBy` tags one with a reference to
// another *in that same returned array* so StateManager can stamp `meta.cause`
// with the right id once both are minted — see stamp()/stampBatch() in
// stateManager.ts. The tag is attached to the event object itself (a hidden,
// non-enumerable symbol) so the return type stays plain `DomainEvent[]`.
const CAUSE = Symbol('cause');

export function causedBy<E extends DomainEvent>(event: E, cause: DomainEvent): E {
  return Object.defineProperty(event, CAUSE, { value: cause, configurable: true });
}

export function causeRefOf(event: DomainEvent): DomainEvent | undefined {
  return (event as Partial<Record<typeof CAUSE, DomainEvent>>)[CAUSE];
}

/** A participating org's durable identity fields, as stored on the activity. */
export type OrganizationInfo = { id: string; title: string; rosterName?: string };
/** A participant's identity + org-specific tags, resolved from the member provider. */
export type ParticipantInfo = { firstname: string; lastname: string; tags: string[] };

export type OrganizationLookup = (organizationId: string) => Promise<OrganizationInfo | undefined>;
export type ParticipantInfoLookup = (organizationId: string, participantId: string) => Promise<ParticipantInfo | undefined>;

/**
 * Server-only dependencies a handler may need. Injected (rather than imported
 * directly) so handlers stay pure/testable — production wiring is at the
 * bottom of this file, mirroring reactors/index.ts's `resolveOrgTags`.
 */
export type CommandServices = {
  getOrganization: OrganizationLookup;
  getParticipantInfo: ParticipantInfoLookup;
};

function unconfigured(name: string) {
  return () => {
    throw new Error(`CommandServices.${name} was not provided`);
  };
}

/** Defaults for callers (mostly tests) that never exercise a lookup — throws loudly if one is. */
const defaultServices: CommandServices = {
  getOrganization: unconfigured('getOrganization') as OrganizationLookup,
  getParticipantInfo: unconfigured('getParticipantInfo') as ParticipantInfoLookup,
};

/**
 * State as of just before this command's events are applied. Lets a handler
 * decide *whether* (and in what order) to emit follow-up events — e.g. an
 * org-switch or cross-activity signout — that a pure reducer couldn't decide
 * for itself without denormalizing that logic into every consumer of the event.
 */
export type CommandContext = { priorActivities: Record<string, Activity> };

export type CommandHandler<P> = (payload: P, ctx: CommandContext, services: CommandServices) => DomainEvent[] | Promise<DomainEvent[]>;

type AnyCommandCreator<T extends string, P> = ((...args: never[]) => { type: T; payload: P }) & { type: T };

function defineCommandHandler<T extends string, P>(command: AnyCommandCreator<T, P>, handle: CommandHandler<P>): [T, CommandHandler<never>] {
  return [command.type, handle as CommandHandler<never>];
}

const commsCommandHandlers = [defineCommandHandler(CommsCommands.LogComm, (payload) => [CommsEvents.CommLogged({ activityId: payload.activityId, comm: createNewCommsEntry(payload.entry) })])];

/** The participant's most recent timeline entry, if they're currently known in this activity. */
function lastUpdateOf(priorActivities: Record<string, Activity>, activityId: string, participantId: string): ParticipantUpdate | undefined {
  return priorActivities[activityId]?.participants[participantId]?.timeline[0];
}

const participantCommandHandlers = [
  defineCommandHandler(ParticipantCommands.AddParticipantTimeline, async (payload, { priorActivities }, services) => {
    const { activityId, participantId, update } = payload;
    const activity = priorActivities[activityId];
    if (!activity) throw new CommandError('Activity does not exist or is not active', 'NO_ACTIVITY');

    const events: DomainEvent[] = [];

    // New to this org on this activity: bring the org onto the activity first,
    // populated from its own record (never trusting whatever the client sent),
    // so the participant event below lands on an org that already exists.
    if (!activity.organizations[update.organizationId]) {
      const org = await services.getOrganization(update.organizationId);
      if (!org) throw new CommandError('Unknown organization', 'NO_ORGANIZATION');
      events.push(
        ActivityEvents.OrganizationTimelineAppended({
          activityId,
          orgId: org.id,
          org,
          status: { time: update.time, status: update.status === ParticipantStatus.Standby ? OrganizationStatus.Standby : OrganizationStatus.Responding },
        }),
      );
    }

    const lastUpdate = lastUpdateOf(priorActivities, activityId, participantId);
    const isNewParticipant = !activity.participants[participantId];
    const isOrgSwitch = lastUpdate !== undefined && lastUpdate?.organizationId !== update.organizationId;

    // Only set once the main event below actually gets emitted — the early
    // return just beneath (signing out while switching orgs) means it never
    // will, so in that case this signout is uncaused, not caused by something
    // that was never emitted.
    let oldOrgSignout: DomainEvent | undefined;
    if (lastUpdate && isOrgSwitch) {
      const alreadyOut = lastUpdate.status === ParticipantStatus.SignedOut || lastUpdate.status === ParticipantStatus.NotResponding;
      if (update.status === ParticipantStatus.SignedOut || !alreadyOut) {
        // Switching orgs while still (or newly) active: close out the old org's timeline
        // first — it precedes the new status chronologically. Skipped if they were already
        // signed out/not-responding at the old org and aren't explicitly signing out now.
        oldOrgSignout = ParticipantEvents.ParticipantTimelineAdded({
          activityId,
          participantId,
          update: { id: uuid(), time: update.time, status: ParticipantStatus.SignedOut, organizationId: lastUpdate.organizationId },
        });
      }
      if (update.status === ParticipantStatus.SignedOut) {
        // Signing out while switching orgs: only the old-org signout happened; nothing else to record.
        return oldOrgSignout ? [...events, oldOrgSignout] : events;
      }
    } else if (lastUpdate && lastUpdate.status === update.status) {
      // No change in status — nothing to record.
      return [];
    }

    // Resolve identity + org-specific tags from the member provider for a
    // brand-new participant, or re-resolve them on an org switch (tags are
    // org-specific, so the old org's tags don't carry over — refetching the
    // name too is harmless). Carried together on the same ParticipantTimelineAdded
    // event below (no separate ParticipantTagged event).
    let participant: ParticipantInfo | undefined;
    if (isNewParticipant || isOrgSwitch) {
      participant = await services.getParticipantInfo(update.organizationId, participantId);
      if (!participant) throw new CommandError('Unknown participant', 'NO_PARTICIPANT');
    }

    const mainEvent = ParticipantEvents.ParticipantTimelineAdded({
      activityId,
      participantId,
      update: { ...update, id: uuid() },
      participant,
    });
    if (oldOrgSignout) events.push(causedBy(oldOrgSignout, mainEvent));
    events.push(mainEvent);

    // Signing in here signs the participant out of every other activity where
    // they were still active and not allowed to be (e.g. still SignedIn there).
    if (update.status === ParticipantStatus.SignedIn) {
      for (const otherActivity of Object.values(priorActivities)) {
        if (otherActivity.id === activityId) continue;
        const otherUpdate = otherActivity.participants[participantId]?.timeline[0];
        if (!otherUpdate || PARTICIPANT_STATUS_ALLOWED_WHILE_ACTIVE_ELSEWHERE.includes(otherUpdate.status)) continue;

        events.push(
          causedBy(
            ParticipantEvents.ParticipantTimelineAdded({
              activityId: otherActivity.id,
              participantId,
              update: { id: uuid(), time: update.time, status: ParticipantStatus.SignedOut, organizationId: otherUpdate.organizationId },
            }),
            mainEvent,
          ),
        );
      }
    }
    return events;
  }),
];

const activityCommandHandlers = [
  defineCommandHandler(ActivityCommands.DecorateOperations, (payload) => [ActivityEvents.OperationsDecorated({ activityId: payload.activityId, operations: createDefaultOperations() })]),

  // Sign every still-signed-in participant out before recording completion, so
  // the completed activity's timeline reflects everyone having left. Each
  // signout is caused by the completion, even though it's emitted first —
  // stampBatch (stateManager.ts) resolves the forward reference.
  defineCommandHandler(ActivityCommands.CompleteActivity, (payload, { priorActivities }) => {
    const { activityId, endTime } = payload;
    const activity = priorActivities[activityId];
    const completed = ActivityEvents.ActivityCompleted({ activityId, endTime });
    const signouts = Object.values(activity?.participants ?? {})
      .filter((participant) => participant.timeline[0]?.status !== ParticipantStatus.SignedOut)
      .map((participant) =>
        causedBy(
          ParticipantEvents.ParticipantTimelineAdded({
            activityId,
            participantId: participant.id,
            update: { id: uuid(), time: endTime, status: ParticipantStatus.SignedOut, organizationId: participant.timeline[0].organizationId },
          }),
          completed,
        ),
      );
    return [...signouts, completed];
  }),
];

// Only domains with at least one non-forwarding command appear here — Place,
// Team, Group, and Resource all declare their target event directly on the
// command (see shared/src/commands/*.ts) and need no explicit handler.
export const explicitCommandHandlers: Record<string, CommandHandler<never>> = Object.fromEntries([...commsCommandHandlers, ...participantCommandHandlers, ...activityCommandHandlers]);

export { defaultServices };

/** Production CommandServices: the real Mongo + member-provider lookups, wired once for StateManager's default constructor arg. */
export const productionCommandServices: CommandServices = {
  async getOrganization(organizationId) {
    const mongo = await mongoPromise;
    const org = await mongo.db().collection<OrganizationDoc>(ORGS_COLLECTION).findOne({ id: organizationId });
    return org ? { id: org.id, title: org.title, rosterName: org.rosterName } : undefined;
  },

  async getParticipantInfo(organizationId, participantId) {
    const mongo = await mongoPromise;
    const org = await mongo.db().collection<OrganizationDoc>(ORGS_COLLECTION).findOne({ id: organizationId });
    if (!org) return undefined;

    const memberProvider = (await getServices()).memberProviders.get(org.memberProvider?.provider);
    if (!memberProvider) return undefined;

    const entry = await memberProvider.getMemberInfoById(participantId);
    if (!entry) return undefined;

    const tags = org.tags?.filter((tag) => entry.groups.some((group) => group === tag.groupId)).map((tag) => tag.label) ?? [];
    return { firstname: entry.given_name, lastname: entry.family_name, tags };
  },
};
