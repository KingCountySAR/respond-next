import type { Draft } from '@reduxjs/toolkit';
import merge from 'lodash.merge';

import { ActivityDomainEventsType, DomainEvents } from '../events';
import { createNewActivity, ParticipantStatus, pickActivityProperties } from '../types/activity';
import { pickTeamProperties } from '../types/operations';

import { ActivityState } from '.';

/**
 * Pure event-appliers keyed by event type. Unlike the legacy action reducers,
 * these only ever run on server-minted events, so they need no client/server
 * branching. They reuse the same domain mutators as the action path. Location
 * events are reduced separately (BasicLocationReducers) into LocationState.
 */
type EventReducers = {
  [K in keyof ActivityDomainEventsType as ActivityDomainEventsType[K]['type']]: (state: Draft<ActivityState>, event: { payload: ReturnType<ActivityDomainEventsType[K]>['payload'] }) => void;
};

function signOutFromOtherActivities(state: Draft<ActivityState>, activityId: string, participantId: string, time: number) {
  state.list
    .filter((f) => f.id !== activityId && f.participants[participantId])
    .forEach((otherActivity) => {
      const timeline = otherActivity.participants[participantId].timeline;
      if (timeline[0].status === ParticipantStatus.SignedIn) {
        timeline.unshift({
          time,
          status: ParticipantStatus.SignedOut,
          organizationId: timeline[0].organizationId,
        });
      }
    });
}

const participantUpdate: EventReducers[typeof DomainEvents.ParticipantUpdated.type] = (state, { payload }) => {
  const { activityId, participant, update } = payload;
  // TODO - doesn't support insert time events. Times must always be more recent than the last update.
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity) return;

  let person = activity.participants[participant.id];
  if (person) {
    const lastUpdate = person.timeline[0];
    if (lastUpdate.organizationId !== participant.organizationId) {
      person.tags = undefined;
      const signoutFromPreviousOrg = {
        organizationId: lastUpdate.organizationId,
        time: update.time,
        status: ParticipantStatus.SignedOut,
      };
      if (update.status === ParticipantStatus.SignedOut) {
        // If they are logging out, log them out of the previous org, then exit.
        person.timeline.unshift(signoutFromPreviousOrg);
        return;
      } else if (lastUpdate.status !== ParticipantStatus.SignedOut && lastUpdate.status !== ParticipantStatus.NotResponding) {
        // If they are remaining active, log them out of the previous org, then continue.
        person.timeline.unshift(signoutFromPreviousOrg);
      }
    } else if (lastUpdate.status === update.status) {
      // Don't record updates if there's no change in status.
      return;
    }
  } else {
    person = {
      ...participant,
      timeline: [],
    };
    activity.participants[participant.id] = person;
  }
  Object.assign(person, participant);
  person.timeline.unshift({
    ...update,
    organizationId: participant.organizationId,
  });

  // If this is a sign-in and the user is already signed into another activity, sign them out of the other activity.
  if (update.status !== ParticipantStatus.SignedIn) {
    signOutFromOtherActivities(state, activityId, participant.id, update.time);
  }
};

export const BasicEventReducers: EventReducers = {
  [DomainEvents.PlaceCreated.type]: function createPlace(state, { payload }) {
    const { activityId, place } = payload;
    const activity = state.list.find((a) => a.id === activityId);
    if (activity) {
      activity.places = [...(activity.places ?? []), place];
      return;
    }

    const newActivity = createNewActivity();
    newActivity.id = activityId;
    newActivity.places = [place];
    state.list.push(newActivity);
  },

  [DomainEvents.PlaceUpdated.type]: function updatePlace(state, { payload }) {
    const { activityId, place } = payload;
    const activity = state.list.find((a) => a.id === activityId);
    if (!activity) return;
    activity.places = (activity.places ?? []).map((p) => (p.id === place.id ? place : p));
  },

  [DomainEvents.PlaceDeleted.type]: function deletePlace(state, { payload }): void {
    const { activityId, placeId } = payload;
    const activity = state.list.find((a) => a.id === activityId);
    if (!activity) return;
    activity.places = (activity.places ?? []).filter((p) => p.id !== placeId);
  },

  [DomainEvents.PlacesBatchChanged.type]: function batchUpdatePlaces(state, { payload }) {
    const { activityId, deleteIds, upserts } = payload;
    const activity = state.list.find((a) => a.id === activityId);
    if (!activity) return;
    const deleteSet = new Set(deleteIds);
    const upsertMap = new Map(upserts.map((p) => [p.id, p]));
    const kept = (activity.places ?? []).filter((p) => !deleteSet.has(p.id)).map((p) => upsertMap.get(p.id) ?? p);
    const created = upserts.filter((p) => !(activity.places ?? []).some((existing) => existing.id === p.id));
    activity.places = [...kept, ...created];
  },

  [DomainEvents.CommLogged.type]: function addComm(state, { payload }) {
    const { activityId, comm } = payload;
    const activity = state.list.find((a) => a.id === activityId);
    if (!activity) return;
    activity.comms = activity.comms ?? [];
    // No dedupe guard needed: comms are server-authored with unique ids and each
    // CommLogged event is applied exactly once per client (no optimistic add).
    activity.comms.push(comm);
  },

  [DomainEvents.CommUpdated.type]: function updateComm(state, { payload }) {
    const { activityId, commId, updates } = payload;
    const activity = state.list.find((a) => a.id === activityId);
    if (!activity || !activity.comms) return;
    const comm = activity.comms.find((entry) => entry.id === commId);
    if (!comm) return;
    Object.assign(comm, updates);
  },

  [DomainEvents.ParticipantUpdated.type]: participantUpdate,

  [DomainEvents.ParticipantTimelineAdded.type]: function participantTimelineAdd(state, { payload }) {
    const { activityId, participantId, update } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity) return;
    const person = activity.participants[participantId];
    if (!person) return;

    person.timeline.unshift(update);

    // If this is a sign-in and the user is already signed into another activity, sign them out of the other activity.
    if (update.status === ParticipantStatus.SignedIn) {
      signOutFromOtherActivities(state, activityId, participantId, update.time);
    }
  },

  [DomainEvents.ParticipantTimelineUpdated.type]: function participantTimelineUpdate(state, { payload }) {
    const { activityId, participantId, update } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity) return;
    const person = activity.participants[participantId];
    if (!person) return;
    // Target the entry by its stable server id. Legacy entries have no id and so
    // can't be edited (guarded in the UI); a missing/unknown id is a no-op.
    if (update.id === undefined) return;
    const index = person.timeline.findIndex((entry) => entry.id === update.id);
    if (index >= 0) person.timeline[index] = update;
  },

  [DomainEvents.ParticipantMilesUpdated.type]: function participantMilesUpdate(state: Draft<ActivityState>, { payload }) {
    const { activityId, participantId, miles } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity) return;
    const person = activity.participants[participantId];
    if (!person) return;
    person.miles = miles;
  },

  [DomainEvents.ParticipantEtaUpdated.type]: function participantEtaUpdate(state, { payload }) {
    const { activityId, participantId, eta } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity) return;
    const person = activity.participants[participantId];
    if (!person) return;
    // null clears the ETA — normalize to undefined so Participant.eta stays number | undefined.
    person.eta = eta ?? undefined;
  },

  [DomainEvents.ParticipantsBulkUpdated.type]: function bulkParticipantUpdate(state, { payload }) {
    const { activityId, updates } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity) return;

    for (const updateRequest of updates) {
      const participant = activity.participants[updateRequest.participantId];
      if (!participant) continue;

      participantUpdate(state, {
        payload: {
          activityId,
          participant: {
            id: participant.id,
            firstname: participant.firstname,
            lastname: participant.lastname,
            organizationId: updateRequest.update.organizationId,
            miles: participant.miles,
            eta: participant.eta,
          },
          update: updateRequest.update,
        },
      });
    }
  },

  [DomainEvents.ParticipantTagged.type]: function tagParticipant(state, { payload }) {
    const { activityId, participantId, tags } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity) return;
    const person = activity.participants[participantId];
    if (!person) return;
    person.tags = tags;
  },

  [DomainEvents.TeamCreated.type]: function createTeam(state: Draft<ActivityState>, { payload }) {
    const { activityId, team } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity) return;
    activity.teams = activity.teams ?? [];
    activity.teams.push(team);
  },

  [DomainEvents.TeamUpdated.type]: function updateTeam(state, { payload }) {
    const { activityId, updates } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity || !activity.teams) return;
    const team = activity.teams.find((t) => t.id === updates.id);
    if (!team) return;
    Object.assign(team, pickTeamProperties(updates));
  },

  [DomainEvents.TeamDeleted.type]: function deleteTeam(state, { payload }) {
    const { activityId, updates } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity) return;
    activity.teams = (activity.teams ?? []).filter((t) => t.id !== updates.id);
  },

  [DomainEvents.TeamMemberAssigned.type]: function assignTeamMember(state, { payload }) {
    const { activityId, participantId, target } = payload;
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

  [DomainEvents.StaffUpdated.type]: function updateStaff(state, { payload }) {
    const { activityId, staff } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity) return;
    activity.staff = {
      ...(activity.staff ?? {}),
      ...staff,
    };
  },

  [DomainEvents.ActivityUpdated.type]: function updateActivity(state, { payload }) {
    const { updates } = payload;
    let target = state.list.find((a) => a.id === updates.id);
    if (!target) {
      target = createNewActivity();
      state.list.push(target);
    }
    merge(target, pickActivityProperties(updates));
  },

  [DomainEvents.ActivityRemoved.type]: function removeActivity(state, { payload }) {
    state.list = state.list.filter((f) => f.id !== payload.activityId);
  },

  [DomainEvents.ActivityCompleted.type]: function completeActivity(state, { payload }) {
    const { activityId, endTime } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity) return;
    activity.endTime = endTime;
    // Sign every participant out at the end time.
    for (const pId in activity.participants) {
      const participant = activity.participants[pId];
      participantUpdate(state, {
        payload: {
          activityId: activity.id,
          participant: {
            id: participant.id,
            firstname: participant.firstname,
            lastname: participant.lastname,
            organizationId: participant.organizationId,
            miles: participant.miles,
            eta: participant.eta,
          },
          update: { time: endTime, status: ParticipantStatus.SignedOut },
        },
      });
    }
  },

  [DomainEvents.ActivityReactivated.type]: function reactivateActivity(state, { payload }) {
    const { activityId } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (activity) activity.endTime = undefined;
  },

  [DomainEvents.OrganizationTimelineAppended.type]: function appendOrganizationTimeline(state, { payload }) {
    const { activityId, orgId, org, status } = payload;
    const activity = state.list.find((f) => f.id === activityId);
    if (!activity) return;
    activity.organizations[orgId] = Object.assign(activity.organizations[orgId] ?? { timeline: [] }, org);
    activity.organizations[orgId].timeline.unshift(status);
  },

  [DomainEvents.OperationsDecorated.type]: function decorateOperations(state, { payload }) {
    const { activityId, operations } = payload;
    const activity = state.list.find((a) => a.id === activityId);
    if (!activity) return;
    if (!activity.teams) activity.teams = operations.teams;
    if (!activity.comms) activity.comms = operations.comms;
    if (!activity.staff) activity.staff = operations.staff;
    if (!activity.places) activity.places = operations.places;
  },
};
