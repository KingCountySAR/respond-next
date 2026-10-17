import { z } from 'zod';
import { Rejection, defineMutation, type MutationCtx, type Tx } from '@sync/core';
import { currentParticipantStatus, findParticipantByPersonRef, participantIdFor, participantName, statusOf } from '../queries';
import { PARTICIPANT_STATUSES, type EventRec, type EventUnitRec, type ParticipantRec, type ParticipantStatus, type ParticipantStatusRec } from '../schema';
import { STANDBY_ONLY_STATUSES, allowedInMode, isStandbyOnly } from '../statusSteps';
import { asMissionViewer, isCommand } from '../viewer';
import { addStatus, at, id, idSource, requireOpen, requireParticipant, requireSelfOrCommand } from './common';

const PersonRef = z.string().regex(/^[a-z0-9-]+:.+$/, 'Expected <source>:<id>');
const Status = z.enum(PARTICIPANT_STATUSES).exclude(['unknown']);
/** The unit someone responds under, with the names to show for it. */
const Unit = z.object({ id, title: z.string().trim().min(1), rosterName: z.string().trim().nullable() });
type Unit = z.infer<typeof Unit>;

const isSystem = (ctx: MutationCtx) => ctx.viewer.userId === 'system';

function ensureUnit(tx: Tx, unit: Unit): void {
  const existing = tx.get<EventUnitRec>('eventUnit', unit.id);
  if (!existing) tx.put({ type: 'eventUnit', id: unit.id, title: unit.title, rosterName: unit.rosterName });
  else if (existing.title !== unit.title || existing.rosterName !== unit.rosterName) tx.update('eventUnit', unit.id, { title: unit.title, rosterName: unit.rosterName });
}

/** Field users signing themselves in follow the event's standby-only and light-mode rules. */
function checkSelfStatus(ctx: MutationCtx, event: EventRec, current: ParticipantStatus, next: ParticipantStatus, at: number): void {
  if (!allowedInMode(event, next)) throw new Rejection('light_mode', 'That status isn’t used on this event');
  if (isCommand(ctx.viewer)) return;
  if (isStandbyOnly(event, current, at) && !STANDBY_ONLY_STATUSES.has(next)) {
    throw new Rejection('standby_only', 'This event is standby only for now');
  }
}

/**
 * Records a status under a unit. Changing units first clears the participant under the old one
 * (unless they weren't active there); clearing under a new unit only clears the old one. The clear
 * goes 1 ms before the new status, so the new status is unambiguously current.
 */
function applyStatus(tx: Tx, ctx: MutationCtx, nextId: () => string, participantId: string, unitId: string, status: ParticipantStatus, at: number): void {
  const previous = currentParticipantStatus(tx, participantId, at);
  if (previous && previous.unitId !== unitId) {
    if (status === 'clear') {
      addStatus(tx, ctx, nextId, participantId, previous.unitId, 'clear', at);
      return;
    }
    if (previous.status !== 'clear' && previous.status !== 'notResponding') addStatus(tx, ctx, nextId, participantId, previous.unitId, 'clear', at - 1);
  }
  addStatus(tx, ctx, nextId, participantId, unitId, status, at);
}

/**
 * Adds someone to the event with their first status, or updates them if they're already on it.
 * New participants get an id derived from their personRef, so two devices adding the same person agree.
 */
export const addParticipant = defineMutation({
  name: 'addParticipant',
  version: 1,
  timed: true,
  args: z.object({
    personRef: PersonRef,
    firstname: z.string().trim().min(1),
    lastname: z.string().trim(),
    unit: Unit,
    status: Status,
    at,
  }),
  describe: (a) => `Add ${a.firstname} ${a.lastname} as ${a.status}`.replace(/\s+/g, ' '),
  run(tx, a, ctx) {
    const event = requireOpen(tx);
    if (!isCommand(ctx.viewer) && asMissionViewer(ctx.viewer).personRef !== a.personRef) throw new Rejection('forbidden', 'You can only sign yourself in');
    const existing = findParticipantByPersonRef(tx, a.personRef);
    const participantId = existing?.id ?? participantIdFor(a.personRef);
    checkSelfStatus(ctx, event, existing ? statusOf(tx, participantId, a.at) : 'unknown', a.status, a.at);
    if (existing) tx.update('participant', participantId, { firstname: a.firstname, lastname: a.lastname });
    else tx.put({ type: 'participant', id: participantId, personRef: a.personRef, firstname: a.firstname, lastname: a.lastname, memberTags: [], missionTags: [], eta: null, miles: null });
    ensureUnit(tx, a.unit);
    applyStatus(tx, ctx, idSource(ctx), participantId, a.unit.id, a.status, a.at);
  },
});

export const setParticipantStatus = defineMutation({
  name: 'setParticipantStatus',
  version: 1,
  timed: true,
  args: z.object({ participantId: id, status: Status, unit: Unit, at }),
  describe: (a, view) => `Set ${participantName(view, a.participantId)} to ${a.status}`,
  run(tx, a, ctx) {
    const event = requireOpen(tx);
    const participant = requireParticipant(tx, a.participantId);
    requireSelfOrCommand(ctx, participant);
    checkSelfStatus(ctx, event, statusOf(tx, a.participantId, a.at), a.status, a.at);
    ensureUnit(tx, a.unit);
    applyStatus(tx, ctx, idSource(ctx), a.participantId, a.unit.id, a.status, a.at);
  },
});

/** Fixes a mistaken entry's time or status. Command only; the log keeps the original. */
export const correctParticipantStatus = defineMutation({
  name: 'correctParticipantStatus',
  version: 1,
  args: z.object({ entryId: id, status: Status.optional(), at: at.optional() }),
  allow: isCommand,
  describe: (a, view) => `Correct ${participantName(view, view.get<ParticipantStatusRec>('participantStatus', a.entryId)?.participantId)}'s timeline`,
  run(tx, a) {
    const event = requireOpen(tx);
    if (!tx.get('participantStatus', a.entryId)) throw new Rejection('not_found', 'That timeline entry no longer exists');
    if (a.status && !allowedInMode(event, a.status)) throw new Rejection('light_mode', 'That status isn’t used on this event');
    tx.update('participantStatus', a.entryId, { ...(a.status ? { status: a.status } : {}), ...(a.at !== undefined ? { at: a.at } : {}) });
  },
});

export const setEta = defineMutation({
  name: 'setEta',
  version: 1,
  args: z.object({ participantId: id, eta: z.number().finite().nullable() }),
  describe: (a, view) => (a.eta === null ? `Clear ${participantName(view, a.participantId)}'s ETA` : `Set ${participantName(view, a.participantId)}'s ETA`),
  run(tx, a, ctx) {
    requireOpen(tx);
    requireSelfOrCommand(ctx, requireParticipant(tx, a.participantId));
    tx.update('participant', a.participantId, { eta: a.eta });
  },
});

export const setMiles = defineMutation({
  name: 'setMiles',
  version: 1,
  args: z.object({ participantId: id, miles: z.number().nonnegative().finite().nullable() }),
  describe: (a, view) => `Set ${participantName(view, a.participantId)}'s miles`,
  run(tx, a, ctx) {
    requireOpen(tx);
    requireSelfOrCommand(ctx, requireParticipant(tx, a.participantId));
    tx.update('participant', a.participantId, { miles: a.miles });
  },
});

export const setMissionTags = defineMutation({
  name: 'setMissionTags',
  version: 1,
  args: z.object({ participantId: id, tags: z.array(z.string().trim().min(1)) }),
  allow: isCommand,
  describe: (a, view) => `Tag ${participantName(view, a.participantId)}`,
  run(tx, a) {
    requireOpen(tx);
    requireParticipant(tx, a.participantId);
    tx.update('participant', a.participantId, { missionTags: [...new Set(a.tags)] });
  },
});

/** Written by the server after a sign-in, from the member database. */
export const setMemberInfo = defineMutation({
  name: 'setMemberInfo',
  version: 1,
  args: z.object({
    participantId: id,
    memberTags: z.array(z.string()),
    contact: z.object({ mobile: z.string().nullable(), email: z.string().nullable() }).nullable(),
  }),
  allow: (viewer) => viewer.userId === 'system',
  describe: (a, view) => `Look up ${participantName(view, a.participantId)}`,
  run(tx, a, ctx) {
    if (!isSystem(ctx)) throw new Rejection('forbidden', 'Only the system writes member info');
    requireParticipant(tx, a.participantId);
    tx.update('participant', a.participantId, { memberTags: a.memberTags });
    // One contact record per participant, keyed by the participant's id.
    if (a.contact) tx.put({ type: 'contact', id: a.participantId, participantId: a.participantId, ...a.contact });
    else if (tx.get('contact', a.participantId)) tx.delete('contact', a.participantId);
  },
});

/** Ties an ad-hoc participant to a member record. */
export const linkPerson = defineMutation({
  name: 'linkPerson',
  version: 1,
  args: z.object({ participantId: id, personRef: PersonRef }),
  allow: isCommand,
  describe: (a, view) => `Link ${participantName(view, a.participantId)} to ${a.personRef}`,
  run(tx, a) {
    requireOpen(tx);
    requireParticipant(tx, a.participantId);
    const other = [...tx.scan<ParticipantRec>('participant')].find((p) => p.personRef === a.personRef && p.id !== a.participantId);
    if (other) throw new Rejection('exists', `${participantName(tx, other.id)} is already on this event as that person`);
    tx.update('participant', a.participantId, { personRef: a.personRef });
  },
});
