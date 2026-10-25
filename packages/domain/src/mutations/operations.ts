/** Units, assignments, teams, groups, places, equipment and comms. All managers only. */
import { z } from 'zod';
import { Rejection, defineMutation, type MutationCtx, type Tx } from '@sync/core';
import { equipmentType, CUSTOM_EQUIPMENT_TYPE_ID } from '../equipment';
import { currentTarget, groupTeams, membersOf, participantName, targetName, teamMembers, teamNameConflict, teamStatusOf } from '../queries';
import { GARS, TEAM_STATUSES, Target, UNIT_STATUSES, type CommRec, type EquipmentRec, type GroupRec, type PlaceRec, type TeamRec, type TeamStatusRec } from '../schema';
import { canManage } from '../viewer';
import { at, emptyTarget, id, idSource, moveParticipant, optionalText, requireOpen, requireOperations, requireParticipant, requireTarget } from './common';

const nameOf = (tx: { get: Tx['get'] }, type: string, recId: string) => tx.get<{ name: string } & TeamRec>(type, recId)?.name ?? `the ${type}`;

function requireRec<T>(tx: Tx, type: string, recId: string): T {
  const rec = tx.get(type, recId);
  if (!rec) throw new Rejection('not_found', `That ${type} no longer exists`);
  return rec as T;
}

/** No other team has this name or a number in it. */
function requireUniqueTeamName(tx: Tx, name: string, teamId: string): void {
  const others = [...tx.scan<TeamRec>('team')].filter((t) => t.id !== teamId).map((t) => t.name);
  const conflict = teamNameConflict(name, others);
  if (conflict) throw new Rejection('name_taken', conflict);
}

function requireNew(tx: Tx, type: string, recId: string): void {
  if (tx.get(type, recId)) throw new Rejection('exists', `That ${type} already exists`);
}

// --- Units ----------------------------------------------------------------------------------

export const setUnitStatus = defineMutation({
  name: 'setUnitStatus',
  version: 1,
  timed: true,
  args: z.object({ unit: z.object({ id, title: z.string().trim().min(1), rosterName: z.string().trim().nullable() }), status: z.enum(UNIT_STATUSES).exclude(['unknown']), at }),
  allow: canManage,
  describe: (a) => `Set ${a.unit.rosterName ?? a.unit.title} to ${a.status}`,
  run(tx, a, ctx) {
    requireOpen(tx);
    if (!tx.get('activityUnit', a.unit.id)) tx.put({ type: 'activityUnit', id: a.unit.id, title: a.unit.title, rosterName: a.unit.rosterName });
    tx.put({ type: 'unitStatus', id: ctx.newId(), unitId: a.unit.id, status: a.status, at: a.at, by: ctx.viewer.userId });
  },
});

// --- Assignments ----------------------------------------------------------------------------

export const assign = defineMutation({
  name: 'assign',
  version: 1,
  timed: true,
  /** `newLeaderId`: if `participantId` leads a team, `newLeaderId` specifies the new leader of that team. */
  args: z.object({ participantId: id, target: Target.nullable(), asLeader: z.boolean().default(false), newLeaderId: id.optional(), at }),
  allow: canManage,
  describe: (a, view) => (a.target ? `Assign ${participantName(view, a.participantId)} to ${targetName(view, a.target)}` : `Unassign ${participantName(view, a.participantId)}`),
  run(tx, a, ctx) {
    requireOperations(tx);
    requireParticipant(tx, a.participantId);
    requireTarget(tx, a.target);
    if (a.asLeader && a.target?.kind !== 'team') throw new Rejection('bad_args', 'Only a team has a leader');
    moveParticipant(tx, ctx, idSource(ctx), a.participantId, a.target, a.at, a.newLeaderId);
    if (a.asLeader && a.target) tx.update('team', a.target.id, { leaderParticipantId: a.participantId });
  },
});

// --- Teams ----------------------------------------------------------------------------------

export const createTeam = defineMutation({
  name: 'createTeam',
  version: 1,
  args: z.object({ id, name: z.string().trim().min(1) }),
  allow: canManage,
  describe: (a) => `Create team ${a.name}`,
  run(tx, a) {
    requireOperations(tx);
    requireNew(tx, 'team', a.id);
    requireUniqueTeamName(tx, a.name, a.id);
    tx.put({ type: 'team', id: a.id, name: a.name, gar: 'green', assignment: null, notes: null, leaderParticipantId: null, groupId: null });
  },
});

export const updateTeam = defineMutation({
  name: 'updateTeam',
  version: 1,
  args: z.object({ id, name: z.string().trim().min(1).optional(), gar: z.enum(GARS).optional(), assignment: optionalText.optional(), notes: optionalText.optional() }),
  allow: canManage,
  describe: (a, view) => `Edit ${nameOf(view, 'team', a.id)}`,
  run(tx, { id: teamId, ...fields }) {
    requireOperations(tx);
    const team = requireRec<TeamRec>(tx, 'team', teamId);
    // Only a new name is checked, so a team brought over with another's name can still be edited.
    if (fields.name !== undefined && fields.name !== team.name) requireUniqueTeamName(tx, fields.name, teamId);
    // Blank text clears the field, as the legacy app's empty strings did.
    const clean = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v === '' ? null : v]));
    tx.update('team', teamId, clean);
  },
});

export const setTeamStatus = defineMutation({
  name: 'setTeamStatus',
  version: 1,
  timed: true,
  args: z.object({ teamId: id, status: z.enum(TEAM_STATUSES).exclude(['disbanded']), at }),
  allow: canManage,
  describe: (a, view) => `Set ${nameOf(view, 'team', a.teamId)} to ${a.status}`,
  run(tx, a, ctx) {
    requireOperations(tx);
    requireTarget(tx, { kind: 'team', id: a.teamId });
    tx.put({ type: 'teamStatus', id: ctx.newId(), teamId: a.teamId, status: a.status, at: a.at, by: ctx.viewer.userId });
  },
});

export const setTeamLeader = defineMutation({
  name: 'setTeamLeader',
  version: 1,
  args: z.object({ teamId: id, participantId: id.nullable() }),
  allow: canManage,
  describe: (a, view) => (a.participantId ? `Make ${participantName(view, a.participantId)} leader of ${nameOf(view, 'team', a.teamId)}` : `Clear the leader of ${nameOf(view, 'team', a.teamId)}`),
  run(tx, a) {
    requireOperations(tx);
    requireTarget(tx, { kind: 'team', id: a.teamId });
    if (a.participantId && !teamMembers(tx, a.teamId).some((p) => p.id === a.participantId)) {
      throw new Rejection('not_member', `${participantName(tx, a.participantId)} isn't on ${nameOf(tx, 'team', a.teamId)}`);
    }
    tx.update('team', a.teamId, { leaderParticipantId: a.participantId });
  },
});

const Reassign = z.object({ reassignTo: Target.nullable(), at });

/** Ends a team: members and equipment move to `reassignTo`, and the team keeps its history. */
export const disbandTeam = defineMutation({
  name: 'disbandTeam',
  version: 1,
  timed: true,
  args: Reassign.extend({ teamId: id }),
  allow: canManage,
  describe: (a, view) => `Disband ${nameOf(view, 'team', a.teamId)}`,
  run(tx, a, ctx) {
    requireOperations(tx);
    requireTarget(tx, { kind: 'team', id: a.teamId });
    const nextId = idSource(ctx);
    const team: Target = { kind: 'team', id: a.teamId };
    emptyTarget(tx, ctx, nextId, teamMembers(tx, a.teamId), team, a.reassignTo, a.at);
    tx.update('team', a.teamId, { leaderParticipantId: null, groupId: null });
    tx.put({ type: 'teamStatus', id: nextId(), teamId: a.teamId, status: 'disbanded', at: a.at, by: ctx.viewer.userId });
  },
});

/** Removes a team created by mistake. Assignment history that named it stays. */
export const deleteTeam = defineMutation({
  name: 'deleteTeam',
  version: 1,
  timed: true,
  args: Reassign.extend({ teamId: id }),
  allow: canManage,
  describe: (a, view) => `Delete ${nameOf(view, 'team', a.teamId)}`,
  run(tx, a, ctx) {
    requireOperations(tx);
    requireRec(tx, 'team', a.teamId);
    if (teamStatusOf(tx, a.teamId) !== 'disbanded') emptyTarget(tx, ctx, idSource(ctx), teamMembers(tx, a.teamId), { kind: 'team', id: a.teamId }, a.reassignTo, a.at);
    for (const s of [...tx.scan<TeamStatusRec>('teamStatus')]) if (s.teamId === a.teamId) tx.delete('teamStatus', s.id);
    tx.delete('team', a.teamId);
  },
});

// --- Groups ---------------------------------------------------------------------------------

export const createGroup = defineMutation({
  name: 'createGroup',
  version: 1,
  args: z.object({ id, name: z.string().trim().min(1) }),
  allow: canManage,
  describe: (a) => `Create group ${a.name}`,
  run(tx, a) {
    requireOperations(tx);
    requireNew(tx, 'group', a.id);
    tx.put({ type: 'group', id: a.id, name: a.name, leaderParticipantId: null });
  },
});

export const updateGroup = defineMutation({
  name: 'updateGroup',
  version: 1,
  args: z.object({ id, name: z.string().trim().min(1) }),
  allow: canManage,
  describe: (a, view) => `Rename ${nameOf(view, 'group', a.id)} to ${a.name}`,
  run(tx, a) {
    requireOperations(tx);
    requireRec(tx, 'group', a.id);
    tx.update('group', a.id, { name: a.name });
  },
});

/** A group leader may be anywhere: on a team, at a place or at the Command Post. */
export const setGroupLeader = defineMutation({
  name: 'setGroupLeader',
  version: 1,
  args: z.object({ groupId: id, participantId: id.nullable() }),
  allow: canManage,
  describe: (a, view) => (a.participantId ? `Make ${participantName(view, a.participantId)} leader of ${nameOf(view, 'group', a.groupId)}` : `Clear the leader of ${nameOf(view, 'group', a.groupId)}`),
  run(tx, a) {
    requireOperations(tx);
    requireRec(tx, 'group', a.groupId);
    if (a.participantId) requireParticipant(tx, a.participantId);
    tx.update('group', a.groupId, { leaderParticipantId: a.participantId });
  },
});

function removeGroup(tx: Tx, ctx: MutationCtx, nextId: () => string, groupId: string, reassignTo: Target | null, at: number): void {
  for (const team of groupTeams(tx, groupId)) tx.update('team', team.id, { groupId: null });
  const group: Target = { kind: 'group', id: groupId };
  emptyTarget(tx, ctx, nextId, membersOf(tx, group), group, reassignTo, at);
  tx.delete('group', groupId);
}

/** Its teams leave the group; people and equipment held directly move to `reassignTo`. */
export const deleteGroup = defineMutation({
  name: 'deleteGroup',
  version: 1,
  timed: true,
  args: Reassign.extend({ groupId: id }),
  allow: canManage,
  describe: (a, view) => `Delete ${nameOf(view, 'group', a.groupId)}`,
  run(tx, a, ctx) {
    requireOperations(tx);
    requireRec(tx, 'group', a.groupId);
    removeGroup(tx, ctx, idSource(ctx), a.groupId, a.reassignTo, a.at);
  },
});

/**
 * Moves a team into a group, or out of one. A team holding its group's leader can only leave if
 * the same change names a new leader or deletes the group.
 */
export const setTeamGroup = defineMutation({
  name: 'setTeamGroup',
  version: 1,
  timed: true,
  args: z.object({ teamId: id, groupId: id.nullable(), newLeaderId: id.optional(), disbandGroup: z.boolean().default(false), at }),
  allow: canManage,
  describe: (a, view) => (a.groupId ? `Move ${nameOf(view, 'team', a.teamId)} to ${nameOf(view, 'group', a.groupId)}` : `Take ${nameOf(view, 'team', a.teamId)} out of its group`),
  run(tx, a, ctx) {
    requireOperations(tx);
    requireTarget(tx, { kind: 'team', id: a.teamId });
    if (a.groupId) requireRec(tx, 'group', a.groupId);
    const team = tx.get<TeamRec>('team', a.teamId)!;
    const leaving = team.groupId && team.groupId !== a.groupId ? tx.get<GroupRec>('group', team.groupId) : undefined;
    if (leaving?.leaderParticipantId) {
      const leaderTarget = currentTarget(tx, leaving.leaderParticipantId);
      if (leaderTarget?.kind === 'team' && leaderTarget.id === a.teamId) {
        if (a.disbandGroup) {
          removeGroup(tx, ctx, idSource(ctx), leaving.id, null, a.at);
        } else if (a.newLeaderId) {
          requireParticipant(tx, a.newLeaderId);
          tx.update('group', leaving.id, { leaderParticipantId: a.newLeaderId });
        } else {
          throw new Rejection('group_leader_on_team', `${team.name} has ${leaving.name}'s leader. Choose a new leader first.`);
        }
      }
    }
    tx.update('team', a.teamId, { groupId: a.groupId });
  },
});

// --- Places ---------------------------------------------------------------------------------

const PlaceFields = z.object({ name: z.string().trim().min(1), lat: z.number().finite().nullable(), lon: z.number().finite().nullable(), notes: optionalText });

export const createPlace = defineMutation({
  name: 'createPlace',
  version: 1,
  args: PlaceFields.extend({ id }),
  allow: canManage,
  describe: (a) => `Create place ${a.name}`,
  run(tx, a) {
    requireOperations(tx);
    requireNew(tx, 'place', a.id);
    tx.put({ type: 'place', ...a, notes: a.notes || null });
  },
});

export const updatePlace = defineMutation({
  name: 'updatePlace',
  version: 1,
  args: PlaceFields.partial().extend({ id }),
  allow: canManage,
  describe: (a, view) => `Edit ${nameOf(view, 'place', a.id)}`,
  run(tx, { id: placeId, ...fields }) {
    requireOperations(tx);
    requireRec<PlaceRec>(tx, 'place', placeId);
    tx.update('place', placeId, fields.notes === '' ? { ...fields, notes: null } : fields);
  },
});

export const deletePlace = defineMutation({
  name: 'deletePlace',
  version: 1,
  timed: true,
  args: Reassign.extend({ placeId: id }),
  allow: canManage,
  describe: (a, view) => `Delete ${nameOf(view, 'place', a.placeId)}`,
  run(tx, a, ctx) {
    requireOperations(tx);
    requireRec(tx, 'place', a.placeId);
    const place: Target = { kind: 'place', id: a.placeId };
    emptyTarget(tx, ctx, idSource(ctx), membersOf(tx, place), place, a.reassignTo, a.at);
    tx.delete('place', a.placeId);
  },
});

// --- Equipment ------------------------------------------------------------------------------

/** An item is created when it's first assigned. Custom items take their name from the user. */
export const createEquipment = defineMutation({
  name: 'createEquipment',
  version: 1,
  args: z.object({ id, typeId: id, name: z.string().trim().min(1).optional(), assignedTo: Target.nullable() }),
  allow: canManage,
  describe: (a) => `Add ${a.name ?? equipmentType(a.typeId)?.name ?? 'equipment'}`,
  run(tx, a) {
    requireOperations(tx);
    requireNew(tx, 'equipment', a.id);
    const type = equipmentType(a.typeId);
    if (!type) throw new Rejection('bad_args', 'Unknown equipment type');
    if (a.typeId === CUSTOM_EQUIPMENT_TYPE_ID && !a.name) throw new Rejection('bad_args', 'A custom item needs a name');
    requireTarget(tx, a.assignedTo);
    tx.put({ type: 'equipment', id: a.id, typeId: a.typeId, category: type.category, name: a.typeId === CUSTOM_EQUIPMENT_TYPE_ID ? a.name! : type.name, assignedTo: a.assignedTo });
  },
});

export const assignEquipment = defineMutation({
  name: 'assignEquipment',
  version: 1,
  args: z.object({ equipmentId: id, target: Target.nullable() }),
  allow: canManage,
  describe: (a, view) => `Move ${nameOf(view, 'equipment', a.equipmentId)} to ${targetName(view, a.target)}`,
  run(tx, a) {
    requireOperations(tx);
    requireRec<EquipmentRec>(tx, 'equipment', a.equipmentId);
    requireTarget(tx, a.target);
    tx.update('equipment', a.equipmentId, { assignedTo: a.target });
  },
});

// --- Comms ----------------------------------------------------------------------------------

export const addComm = defineMutation({
  name: 'addComm',
  version: 1,
  timed: true,
  args: z.object({ id, from: z.string().trim(), to: z.string().trim(), message: z.string().trim().min(1), at }),
  allow: canManage,
  describe: (a) => `Log "${a.message.length > 40 ? `${a.message.slice(0, 40)}…` : a.message}"`,
  run(tx, a, ctx) {
    requireOperations(tx);
    requireNew(tx, 'comm', a.id);
    tx.put({ type: 'comm', id: a.id, from: a.from, to: a.to, message: a.message, favorite: false, removed: false, at: a.at, by: ctx.viewer.userId });
  },
});

/** Editing the text or time of an imported automated entry makes it a person's (Normal), as the legacy app did; starring it doesn't. */
export const editComm = defineMutation({
  name: 'editComm',
  version: 1,
  args: z.object({ id, from: z.string().trim().optional(), to: z.string().trim().optional(), message: z.string().trim().min(1).optional(), at: at.optional(), favorite: z.boolean().optional() }),
  allow: canManage,
  describe: () => 'Edit a comms entry',
  run(tx, { id: commId, ...fields }) {
    requireOperations(tx);
    const comm = requireRec<CommRec>(tx, 'comm', commId);
    if (comm.removed) throw new Rejection('removed', 'That comms entry was deleted');
    const edited = (['from', 'to', 'message', 'at'] as const).some((k) => fields[k] !== undefined);
    tx.update('comm', commId, edited && comm.automated ? { ...fields, automated: false } : fields);
  },
});

/** Soft delete: the entry stays for the record. */
export const deleteComm = defineMutation({
  name: 'deleteComm',
  version: 1,
  args: z.object({ id }),
  allow: canManage,
  describe: () => 'Delete a comms entry',
  run(tx, a) {
    requireOperations(tx);
    requireRec(tx, 'comm', a.id);
    tx.update('comm', a.id, { removed: true });
  },
});
