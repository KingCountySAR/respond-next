import { z } from 'zod';
import { Rejection, type MutationCtx, type ReadView, type Tx } from '@sync/core';
import { currentParticipantStatus, currentTarget, getEvent, hasOperations, sameTarget, targetExists, targetName } from '../queries';
import { Target, type EquipmentRec, type EventRec, type ParticipantRec, type ParticipantStatus, type TeamRec } from '../schema';
import { asMissionViewer, isCommand } from '../viewer';

export const id = z.string().min(1);
export const at = z.number().finite();
export const optionalText = z.string().trim().nullable();

/** Hands out the deterministic ids for the records one mutation creates. */
export function idSource(ctx: MutationCtx): () => string {
  let n = 0;
  return () => ctx.newId(n++);
}

export function requireEvent(view: ReadView): EventRec {
  const event = getEvent(view);
  if (!event || event.removedAt !== null) throw new Rejection('no_event', 'This event no longer exists');
  return event;
}

/** Every mutation except reopening needs an open event. */
export function requireOpen(view: ReadView): EventRec {
  const event = requireEvent(view);
  if (event.closed) throw new Rejection('closed', 'This event is closed');
  return event;
}

/** Teams, groups, places, equipment and comms exist only in full mode. */
export function requireOperations(view: ReadView): EventRec {
  const event = requireOpen(view);
  if (!hasOperations(event)) throw new Rejection('light_mode', 'This event has no operations');
  return event;
}

export function requireParticipant(view: ReadView, participantId: string): ParticipantRec {
  const p = view.get<ParticipantRec>('participant', participantId);
  if (!p) throw new Rejection('not_found', 'That person is no longer on this event');
  return p;
}

/** Command may change anyone; field users only themselves. */
export function requireSelfOrCommand(ctx: MutationCtx, participant: ParticipantRec): void {
  if (isCommand(ctx.viewer)) return;
  const personRef = asMissionViewer(ctx.viewer).personRef;
  if (!personRef || personRef !== participant.personRef) throw new Rejection('forbidden', 'You can only change your own entry');
}

export function requireTarget(view: ReadView, target: Target | null): void {
  if (target && !targetExists(view, target)) throw new Rejection('target_gone', `That ${target.kind} no longer exists`);
}

/** Adds a status entry unless the participant already had that status, under that unit, at `at`. */
export function addStatus(tx: Tx, ctx: MutationCtx, nextId: () => string, participantId: string, unitId: string, status: ParticipantStatus, at: number): boolean {
  const current = currentParticipantStatus(tx, participantId, at);
  if (current && current.status === status && current.unitId === unitId) return false;
  tx.put({ type: 'participantStatus', id: nextId(), participantId, unitId, status, at, by: ctx.viewer.userId });
  return true;
}

/**
 * Moves a participant, keeping their status in step as the legacy app did: staging becomes assigned
 * when they're put somewhere, and assigned becomes staging when they're taken off. Other statuses
 * are left alone. Leaving a team they lead clears its leader.
 */
export function moveParticipant(tx: Tx, ctx: MutationCtx, nextId: () => string, participantId: string, target: Target | null, at: number): void {
  const previous = currentTarget(tx, participantId, at);
  if (sameTarget(previous, target)) return;
  if (previous?.kind === 'team') {
    const team = tx.get<TeamRec>('team', previous.id);
    if (team?.leaderParticipantId === participantId) tx.update('team', team.id, { leaderParticipantId: null });
  }
  tx.put({ type: 'assignment', id: nextId(), participantId, target, at, by: ctx.viewer.userId });

  const status = currentParticipantStatus(tx, participantId, at);
  if (!status) return;
  if (target && status.status === 'staging') addStatus(tx, ctx, nextId, participantId, status.unitId, 'assigned', at);
  else if (!target && status.status === 'assigned') addStatus(tx, ctx, nextId, participantId, status.unitId, 'staging', at);
}

/** Moves everyone and everything at `from` to `to` (a team, group or place going away). */
export function emptyTarget(tx: Tx, ctx: MutationCtx, nextId: () => string, members: ParticipantRec[], from: Target, to: Target | null, at: number): void {
  if (to && sameTarget(from, to)) throw new Rejection('bad_target', `Can't move everyone to the ${from.kind} being removed`);
  requireTarget(tx, to);
  for (const p of members) moveParticipant(tx, ctx, nextId, p.id, to, at);
  for (const e of tx.scan<EquipmentRec>('equipment')) {
    if (sameTarget(e.assignedTo, from)) tx.update('equipment', e.id, { assignedTo: to });
  }
}

export const describeTarget = targetName;
