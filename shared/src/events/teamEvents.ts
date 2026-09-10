import type { Draft } from '@reduxjs/toolkit';

import type { ActivityState } from '..';
import { AssignmentTarget, EquipmentItem, pickTeamProperties, Team } from '../types/operations';

import { defineEvent } from './defineEvent';

// Facts about teams + staff assignments, minted by the server.

export type TeamTargetPayload = { activityId: string; id: string; target: AssignmentTarget };

export const TeamEvents = {
  TeamCreated: defineEvent(
    //
    'evt/team/created',
    (state: Draft<ActivityState>, { activityId, team }: { activityId: string; team: Team }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      activity.teams = activity.teams ?? [];
      activity.teams.push(team);
    },
  ),

  TeamUpdated: defineEvent(
    //
    'evt/team/updated',
    (state: Draft<ActivityState>, { activityId, updates }: { activityId: string; updates: Partial<Team> & { id: string } }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity || !activity.teams) return;
      const team = activity.teams.find((t) => t.id === updates.id);
      if (!team) return;
      Object.assign(team, pickTeamProperties(updates));
    },
  ),

  TeamDisbanded: defineEvent(
    //
    'evt/team/disbanded',
    (state: Draft<ActivityState>, { activityId, id }: TeamTargetPayload) => {
      const team = state.list.find((f) => f.id === activityId)?.teams?.find((t) => t.id === id);
      if (!team) return;
      team.status = 'Disbanded';
    },
  ),

  TeamDeleted: defineEvent(
    //
    'evt/team/deleted',
    (state: Draft<ActivityState>, { activityId, id }: TeamTargetPayload) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      activity.teams = (activity.teams ?? []).filter((t) => t.id !== id);
    },
  ),

  StaffUpdated: defineEvent(
    //
    'evt/team/staffUpdated',
    (state: Draft<ActivityState>, { activityId, staff }: { activityId: string; staff: Record<string, string> }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      activity.staff = {
        ...(activity.staff ?? {}),
        ...staff,
      };
    },
  ),

  // A single responder's assignment changed: the reducer removes them from
  // wherever they were and adds them to `target` (undefined = unassigned).
  // Naming a specific participant lets reactors act on *who* moved (e.g. flip
  // their Assigned/Available status).
  //
  // `target` is a required key (not `target?:`) even though AssignmentTarget's
  // own union already includes `undefined` — this matches the payload shape RTK
  // infers from the object-literal `{ ..., target }` prepare callbacks in
  // teamCommands.ts, where the key is always present.
  TeamMemberAssigned: defineEvent(
    //
    'evt/team/memberAssigned',
    (state: Draft<ActivityState>, { activityId, participantId, target }: { activityId: string; participantId: string; target: AssignmentTarget }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;

      // Remove the participant from wherever they currently are.
      for (const team of activity.teams ?? []) {
        if (!team.assignedParticipants.includes(participantId)) continue;
        team.assignedParticipants = team.assignedParticipants.filter((id) => id !== participantId);
      }
      for (const place of activity.places ?? []) {
        if (place.assignedParticipants.includes(participantId)) {
          place.assignedParticipants = place.assignedParticipants.filter((id) => id !== participantId);
        }
      }

      // Add to the target. For a team, `asLeader` puts them first so they become
      // the lead (the first member is always the lead).
      if (target?.type === 'team') {
        const team = (activity.teams ?? []).find((t) => t.id === target.id);
        if (team) {
          team.assignedParticipants = target.asLeader ? [participantId, ...team.assignedParticipants] : [...team.assignedParticipants, participantId];
        }
      } else if (target?.type === 'place') {
        const place = (activity.places ?? []).find((p) => p.id === target.id);
        if (place) place.assignedParticipants = [...place.assignedParticipants, participantId];
      }
    },
  ),

  // A single piece of equipment moved: the reducer removes it (by uuid) from
  // wherever it was and adds it to `target` (undefined = back to inventory).
  TeamEquipmentAssigned: defineEvent(
    //
    'evt/team/equipmentAssigned',
    (state: Draft<ActivityState>, { activityId, item, target }: { activityId: string; item: EquipmentItem; target: AssignmentTarget }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;

      // Remove the item (matched by uuid) from wherever it currently is.
      for (const team of activity.teams ?? []) {
        team.assignedEquipment = team.assignedEquipment.filter((e) => e.uuid !== item.uuid);
      }
      for (const place of activity.places ?? []) {
        place.assignedEquipment = place.assignedEquipment.filter((e) => e.uuid !== item.uuid);
      }

      // Add to the target. An undefined target means it returns to inventory.
      if (target?.type === 'team') {
        const team = (activity.teams ?? []).find((t) => t.id === target.id);
        if (team) team.assignedEquipment = [...team.assignedEquipment, item];
      } else if (target?.type === 'place') {
        const place = (activity.places ?? []).find((p) => p.id === target.id);
        if (place) place.assignedEquipment = [...place.assignedEquipment, item];
      }
    },
  ),
};
