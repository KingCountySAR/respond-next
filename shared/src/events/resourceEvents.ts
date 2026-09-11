import type { Draft } from '@reduxjs/toolkit';

import type { ActivityState } from '..';
import { Activity } from '../types/activity';
import { AssignmentTarget, EquipmentItem } from '../types/operations';

import { defineEvent } from './defineEvent';

// Facts about where a participant or piece of equipment is currently
// assigned (a team, a place, a group, or nowhere). Generalized out of the old
// team-only TeamMemberAssigned/TeamEquipmentAssigned events since a target can
// now be any of the three assignable entities.

export type ParticipantAssignedPayload = { activityId: string; participantId: string; target: AssignmentTarget };
export type EquipmentAssignedPayload = { activityId: string; item: EquipmentItem; target: AssignmentTarget };

function addParticipantAssignment(activity: Draft<Activity>, participantId: string, target: AssignmentTarget) {
  if (target?.type === 'team') {
    const team = (activity.teams ?? []).find((t) => t.id === target.id);
    if (team) {
      // For a team, `asLeader` puts them first so they become the lead (the first member is always the lead).
      team.assignedParticipants = target.asLeader ? [participantId, ...team.assignedParticipants] : [...team.assignedParticipants, participantId];
    }
  } else if (target?.type === 'place') {
    const place = (activity.places ?? []).find((p) => p.id === target.id);
    if (place) place.assignedParticipants = [...place.assignedParticipants, participantId];
  } else if (target?.type === 'group') {
    const group = (activity.groups ?? []).find((p) => p.id === target.id);
    if (group) group.assignedParticipants = [...group.assignedParticipants, participantId];
  }
}

function removeParticipantAssignment(activity: Draft<Activity>, participantId: string) {
  for (const team of activity.teams ?? []) {
    team.assignedParticipants = team.assignedParticipants.filter((id) => id !== participantId);
  }
  for (const place of activity.places ?? []) {
    place.assignedParticipants = place.assignedParticipants.filter((id) => id !== participantId);
  }
  for (const group of activity.groups ?? []) {
    group.assignedParticipants = group.assignedParticipants.filter((id) => id !== participantId);
  }
}

function addEquipmentAssignment(activity: Draft<Activity>, item: EquipmentItem, target: AssignmentTarget) {
  if (target?.type === 'team') {
    const team = (activity.teams ?? []).find((t) => t.id === target.id);
    if (team) team.assignedEquipment = [...team.assignedEquipment, item];
  } else if (target?.type === 'place') {
    const place = (activity.places ?? []).find((p) => p.id === target.id);
    if (place) place.assignedEquipment = [...place.assignedEquipment, item];
  } else if (target?.type === 'group') {
    const group = (activity.groups ?? []).find((p) => p.id === target.id);
    if (group) group.assignedEquipment = [...group.assignedEquipment, item];
  }
}

function removeEquipmentAssignment(activity: Draft<Activity>, item: EquipmentItem) {
  for (const team of activity.teams ?? []) {
    team.assignedEquipment = team.assignedEquipment.filter((e) => e.uuid !== item.uuid);
  }
  for (const place of activity.places ?? []) {
    place.assignedEquipment = place.assignedEquipment.filter((e) => e.uuid !== item.uuid);
  }
  for (const group of activity.groups ?? []) {
    group.assignedEquipment = group.assignedEquipment.filter((e) => e.uuid !== item.uuid);
  }
}

export const ResourceEvents = {
  ParticipantAssigned: defineEvent(
    //
    'evt/resource/participantAssigned',
    (state: Draft<ActivityState>, { activityId, participantId, target }: ParticipantAssignedPayload) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      // Remove the participant from wherever they currently are, then add to the target.
      removeParticipantAssignment(activity, participantId);
      addParticipantAssignment(activity, participantId, target);
    },
  ),

  EquipmentAssigned: defineEvent(
    //
    'evt/resource/equipmentAssigned',
    (state: Draft<ActivityState>, { activityId, item, target }: EquipmentAssignedPayload) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      // Remove the item (matched by uuid) from wherever it currently is, then
      // add to the target. An undefined target means it returns to inventory.
      removeEquipmentAssignment(activity, item);
      addEquipmentAssignment(activity, item, target);
    },
  ),
};
