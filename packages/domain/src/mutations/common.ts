import { z } from 'zod';
import { Rejection, type MutationCtx, type ReadView, type Tx } from '@sync/core';
import { currentParticipantStatus, currentTarget, getActivity, hasOperations, membersOf, sameTarget, targetExists, targetName } from '../queries';
import { Target, type EquipmentRec, type ActivityRec, type ParticipantRec, type ParticipantStatus, type TeamRec } from '../schema';
import { asActivityViewer, isCommand, isSystemViewer } from '../viewer';

export const id = z.string().min(1);
export const at = z.number().finite();
export const optionalText = z.string().trim().nullable();

/** Hands out the deterministic ids for the records one mutation creates. */
export function idSource(ctx: MutationCtx): () => string {
  let n = 0;
  return () => ctx.newId(n++);
}

export function requireActivity(view: ReadView): ActivityRec {
  const activity = getActivity(view);
  if (!activity || activity.removedAt !== null) throw new Rejection('no_activity', 'This event no longer exists');
  return activity;
}

/** Every mutation except reopening needs an open activity. */
export function requireOpen(view: ReadView): ActivityRec {
  const activity = requireActivity(view);
  if (activity.closed) throw new Rejection('closed', 'This event is closed');
  return activity;
}

/** Teams, groups, places, equipment and comms exist only in full mode. */
export function requireOperations(view: ReadView): ActivityRec {
  const activity = requireOpen(view);
  if (!hasOperations(activity)) throw new Rejection('light_mode', 'This event has no operations');
  return activity;
}

export function requireParticipant(view: ReadView, participantId: string): ParticipantRec {
  const p = view.get<ParticipantRec>('participant', participantId);
  if (!p) throw new Rejection('not_found', 'That person is no longer on this event');
  return p;
}

/** Command may change anyone; field users only themselves. */
export function requireSelfOrCommand(ctx: MutationCtx, participant: ParticipantRec): void {
  if (isCommand(ctx.viewer)) return;
  const personRef = asActivityViewer(ctx.viewer).personRef;
  if (!personRef || personRef !== participant.personRef) throw new Rejection('forbidden', 'You can only change your own entry');
}

export function requireTarget(view: ReadView, target: Target | null): void {
  if (target && !targetExists(view, target)) throw new Rejection('target_gone', `That ${target.kind} no longer exists`);
}

/** The name of whoever is making a change, as they signed in. */
export function actorName(ctx: MutationCtx): string {
  return asActivityViewer(ctx.viewer).name ?? (isSystemViewer(ctx.viewer) ? 'The server' : 'Someone');
}

/**
 * Adds a status entry unless the participant already had that status, under that unit, at `at`. It
 * names who made it when that isn't the participant, and `cause` when the change asked for something
 * else (closing the activity clears everyone).
 */
export function addStatus(tx: Tx, ctx: MutationCtx, nextId: () => string, participantId: string, unitId: string, status: ParticipantStatus, at: number, cause?: string): boolean {
  const current = currentParticipantStatus(tx, participantId, at);
  if (current && current.status === status && current.unitId === unitId) return false;
  const personRef = tx.get<ParticipantRec>('participant', participantId)?.personRef;
  const self = !!personRef && personRef === asActivityViewer(ctx.viewer).personRef;
  tx.put({ type: 'participantStatus', id: nextId(), participantId, unitId, status, at, by: ctx.viewer.userId, ...(self ? {} : { byName: actorName(ctx) }), ...(cause ? { cause } : {}) });
  return true;
}

/**
 * Moves a participant, keeping their status in step as the legacy app did: staging becomes assigned
 * when they're put somewhere, and assigned becomes staging when they're taken off. Other statuses
 * are left alone. When a team's leader leaves it, `newLeaderId` (one of those staying, picked by
 * whoever moved them) leads it; with none given (the one member left needs no picking), the first
 * member found does, and with nobody left it has no leader.
 */
export function moveParticipant(tx: Tx, ctx: MutationCtx, nextId: () => string, participantId: string, target: Target | null, at: number, newLeaderId?: string): void {
  const previous = currentTarget(tx, participantId, at);
  if (sameTarget(previous, target)) return;
  tx.put({ type: 'assignment', id: nextId(), participantId, target, at, by: ctx.viewer.userId });
  if (previous?.kind === 'team') {
    const team = tx.get<TeamRec>('team', previous.id);
    if (team?.leaderParticipantId === participantId) {
      const staying = membersOf(tx, previous);
      if (newLeaderId && !staying.some((p) => p.id === newLeaderId)) throw new Rejection('not_member', 'The new leader is no longer on the team');
      tx.update('team', team.id, { leaderParticipantId: newLeaderId ?? staying[0]?.id ?? null });
    }
  }

  const status = currentParticipantStatus(tx, participantId, at);
  if (!status) return;
  if (target && status.status === 'staging') addStatus(tx, ctx, nextId, participantId, status.unitId, 'assigned', at, `Assigned to ${targetName(tx, target)}`);
  else if (!target && status.status === 'assigned') addStatus(tx, ctx, nextId, participantId, status.unitId, 'staging', at, 'Unassigned');
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
