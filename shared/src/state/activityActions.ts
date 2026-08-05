import { createAction } from '@reduxjs/toolkit';

import { Activity, OrganizationStatus, ParticipantStatus, ParticipantUpdate, pickActivityProperties } from '../types/activity';
import { CommunicationsLogEntry, pickTeamProperties, Place, Team } from '../types/operations';

import { ActivityState } from '.';

const reload = createAction('activities/load', (state: ActivityState) => ({
  payload: state,
  meta: { sync: false },
}));

const update = createAction('activity/update', (updates: Partial<Activity> & { id: string }) => ({
  payload: pickActivityProperties(updates),
  meta: { sync: true },
}));

const createPlace = createAction('place/create', (activityId: string, place: Place) => ({
  payload: { activityId, place },
  meta: { sync: true },
}));

const updatePlace = createAction('place/update', (activityId: string, place: Place) => ({
  payload: { activityId, place },
  meta: { sync: true },
}));

const deletePlace = createAction('place/delete', (activityId: string, placeId: string) => ({
  payload: { activityId, placeId },
  meta: { sync: true },
}));

// upsert = create-or-update; delete by id
const batchUpdatePlaces = createAction('place/batchUpdate', (activityId: string, upserts: Place[], deleteIds: string[]) => ({
  payload: { activityId, upserts, deleteIds },
  meta: { sync: true },
}));

const remove = createAction('activity/remove', (activityId: string) => ({
  payload: { id: activityId },
  meta: { sync: true },
}));

const reactivate = createAction('activity/reactivate', (activityId: string) => ({
  payload: { id: activityId },
  meta: { sync: true },
}));

const complete = createAction('activity/complete', (activityId: string, endTime: number) => ({
  payload: { id: activityId, endTime },
  meta: { sync: true },
}));

const appendOrganizationTimeline = createAction('participatingOrg/append', (activityId: string, org: { id: string; title: string; rosterName?: string }, status: { time: number; status: OrganizationStatus }) => ({
  payload: { activityId, orgId: org.id, org, status },
  meta: { sync: true },
}));

const participantUpdate = createAction('participant/update', (activityId: string, participantId: string, firstname: string, lastname: string, organizationId: string, time: number, status: ParticipantStatus, miles?: number, eta?: number) => ({
  payload: {
    activityId,
    participant: {
      id: participantId,
      firstname,
      lastname,
      organizationId,
      miles,
      eta,
    },
    update: {
      time,
      status,
    },
  },
  meta: { sync: true },
}));

const bulkParticipantUpdate = createAction('participant/bulkUpdate', (activityId: string, updates: Array<{ participantId: string; update: ParticipantUpdate }>) => ({
  payload: { activityId, updates },
  meta: { sync: true },
}));

const participantTimelineUpdate = createAction('participant/timeline', (activityId: string, participantId: string, update: ParticipantUpdate, index: number) => ({
  payload: {
    activityId,
    participantId,
    update,
    index,
  },
  meta: { sync: true },
}));

const participantTimelineAdd = createAction('participant/timelineAdd', (activityId: string, participantId: string, update: ParticipantUpdate) => ({
  payload: {
    activityId,
    participantId,
    update,
  },
  meta: { sync: true },
}));

const participantMilesUpdate = createAction('participant/milesUpdate', (activityId: string, participantId: string, miles: number) => ({
  payload: {
    activityId,
    participantId,
    miles,
  },
  meta: { sync: true },
}));

const participantEtaUpdate = createAction('participant/etaUpdate', (activityId: string, participantId: string, eta: number) => ({
  payload: {
    activityId,
    participantId,
    eta,
  },
  meta: { sync: true },
}));

const tagParticipant = createAction('participant/tag', (activityId: string, participantId: string, tags: string[]) => ({
  payload: {
    activityId,
    participantId,
    tags,
  },
  meta: { sync: false },
}));

const addComm = createAction('activity/commsAdd', (activityId: string, comm: CommunicationsLogEntry) => ({
  payload: {
    activityId,
    comm,
  },
  meta: { sync: true },
}));

const updateComm = createAction('activity/commsUpdate', (activityId: string, commId: string, updates: Partial<CommunicationsLogEntry>) => ({
  payload: {
    activityId,
    commId,
    updates,
  },
  meta: { sync: true },
}));

const updateStaff = createAction('activity/staffUpdate', (activityId: string, staff: Record<string, string>) => ({
  payload: {
    activityId,
    staff,
  },
  meta: { sync: true },
}));

const createTeam = createAction('team/create', (activityId: string, team: Team) => ({
  payload: {
    activityId,
    team,
  },
  meta: { sync: true },
}));

const updateTeam = createAction('team/update', (activityId: string, updates: Partial<Team> & { id: string }) => ({
  payload: {
    activityId,
    updates: pickTeamProperties(updates),
  },
  meta: { sync: true },
}));

export const ActivityActions = {
  reload,
  update,
  createPlace,
  updatePlace,
  deletePlace,
  batchUpdatePlaces,
  remove,
  reactivate,
  complete,
  appendOrganizationTimeline,
  participantUpdate,
  bulkParticipantUpdate,
  participantTimelineUpdate,
  participantTimelineAdd,
  participantMilesUpdate,
  participantEtaUpdate,
  tagParticipant,
  addComm,
  updateComm,
  updateStaff,
  createTeam,
  updateTeam,
};

export type ActivityActionsType = typeof ActivityActions;
type AllActivityActions = {
  [K in keyof ActivityActionsType]: ReturnType<ActivityActionsType[K]>;
};
export type ActivityAction = AllActivityActions[keyof AllActivityActions];

export function isActivityAction(object: { type: string }): object is ActivityAction {
  return Object.values(ActivityActions).some((a) => a.type === object.type);
}

export type ParticipantUpdateAction = AllActivityActions['participantUpdate'];
