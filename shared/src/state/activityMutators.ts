import type { Draft } from '@reduxjs/toolkit';
import merge from 'lodash.merge';

import { Activity, createNewActivity, OrganizationStatus, ParticipantStatus, ParticipantUpdate, pickActivityProperties } from '../types/activity';
import { CommunicationsLogEntry, OperationsSpecificFields, pickTeamProperties, Place, Team } from '../types/operations';

import { ActivityState } from '.';

/** The participant identity fields a status update carries (no timeline/tags). */
type ParticipantInput = { id: string; firstname: string; lastname: string; organizationId: string; miles?: number; eta?: number };
/** A participantUpdate status change; the org is taken from the participant, not the update. */
type StatusUpdate = { id?: string; time: number; status: ParticipantStatus };

/**
 * Pure state mutators for the Places + Comms domains, factored out of the
 * action reducers so the same logic backs both the legacy action path
 * (activityReducers) and the new event path (eventReducers) during the
 * command/event strangle. Each takes plain domain args (not an action/event
 * payload) and mutates the immer draft in place.
 */

export function createPlace(state: Draft<ActivityState>, activityId: string, place: Place): void {
  const activity = state.list.find((a) => a.id === activityId);
  if (activity) {
    activity.places = [...(activity.places ?? []), place];
    return;
  }

  const newActivity = createNewActivity();
  newActivity.id = activityId;
  newActivity.places = [place];
  state.list.push(newActivity);
}

export function updatePlace(state: Draft<ActivityState>, activityId: string, place: Place): void {
  const activity = state.list.find((a) => a.id === activityId);
  if (!activity) return;
  activity.places = (activity.places ?? []).map((p) => (p.id === place.id ? place : p));
}

export function deletePlace(state: Draft<ActivityState>, activityId: string, placeId: string): void {
  const activity = state.list.find((a) => a.id === activityId);
  if (!activity) return;
  activity.places = (activity.places ?? []).filter((p) => p.id !== placeId);
}

export function batchUpdatePlaces(state: Draft<ActivityState>, activityId: string, upserts: Place[], deleteIds: string[]): void {
  const activity = state.list.find((a) => a.id === activityId);
  if (!activity) return;
  const deleteSet = new Set(deleteIds);
  const upsertMap = new Map(upserts.map((p) => [p.id, p]));
  const kept = (activity.places ?? []).filter((p) => !deleteSet.has(p.id)).map((p) => upsertMap.get(p.id) ?? p);
  const created = upserts.filter((p) => !(activity.places ?? []).some((existing) => existing.id === p.id));
  activity.places = [...kept, ...created];
}

export function addComm(state: Draft<ActivityState>, activityId: string, comm: CommunicationsLogEntry): void {
  const activity = state.list.find((a) => a.id === activityId);
  if (!activity) return;
  activity.comms = activity.comms ?? [];
  // No dedupe guard needed: comms are server-authored with unique ids and each
  // CommLogged event is applied exactly once per client (no optimistic add).
  activity.comms.push(comm);
}

export function updateComm(state: Draft<ActivityState>, activityId: string, commId: string, updates: Partial<CommunicationsLogEntry>): void {
  const activity = state.list.find((a) => a.id === activityId);
  if (!activity || !activity.comms) return;
  const comm = activity.comms.find((entry) => entry.id === commId);
  if (!comm) return;
  Object.assign(comm, updates);
}

// ---- Participants ----------------------------------------------------------

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

export function participantUpdate(state: Draft<ActivityState>, activityId: string, participant: ParticipantInput, update: StatusUpdate): void {
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
}

export function bulkParticipantUpdate(state: Draft<ActivityState>, activityId: string, updates: Array<{ participantId: string; update: ParticipantUpdate }>): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity) return;

  for (const updateRequest of updates) {
    const participant = activity.participants[updateRequest.participantId];
    if (!participant) continue;

    participantUpdate(
      state,
      activityId,
      {
        id: participant.id,
        firstname: participant.firstname,
        lastname: participant.lastname,
        organizationId: updateRequest.update.organizationId,
        miles: participant.miles,
        eta: participant.eta,
      },
      updateRequest.update,
    );
  }
}

export function participantTimelineUpdate(state: Draft<ActivityState>, activityId: string, participantId: string, update: ParticipantUpdate): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity) return;
  const person = activity.participants[participantId];
  if (!person) return;
  // Target the entry by its stable server id. Legacy entries have no id and so
  // can't be edited (guarded in the UI); a missing/unknown id is a no-op.
  if (update.id === undefined) return;
  const index = person.timeline.findIndex((entry) => entry.id === update.id);
  if (index >= 0) person.timeline[index] = update;
}

export function participantTimelineAdd(state: Draft<ActivityState>, activityId: string, participantId: string, update: ParticipantUpdate): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity) return;
  const person = activity.participants[participantId];
  if (!person) return;

  person.timeline.unshift(update);

  // If this is a sign-in and the user is already signed into another activity, sign them out of the other activity.
  if (update.status === ParticipantStatus.SignedIn) {
    signOutFromOtherActivities(state, activityId, participantId, update.time);
  }
}

export function participantMilesUpdate(state: Draft<ActivityState>, activityId: string, participantId: string, miles: number): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity) return;
  const person = activity.participants[participantId];
  if (!person) return;
  person.miles = miles;
}

export function participantEtaUpdate(state: Draft<ActivityState>, activityId: string, participantId: string, eta: number | null): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity) return;
  const person = activity.participants[participantId];
  if (!person) return;
  // null clears the ETA — normalize to undefined so Participant.eta stays number | undefined.
  person.eta = eta ?? undefined;
}

export function tagParticipant(state: Draft<ActivityState>, activityId: string, participantId: string, tags: string[]): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity) return;
  const person = activity.participants[participantId];
  if (!person) return;
  person.tags = tags;
}

// ---- Teams + staff ---------------------------------------------------------

export function createTeam(state: Draft<ActivityState>, activityId: string, team: Team): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity) return;
  activity.teams = activity.teams ?? [];
  activity.teams.push(team);
}

export function updateTeam(state: Draft<ActivityState>, activityId: string, updates: Partial<Team>): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity || !activity.teams) return;
  const team = activity.teams.find((t) => t.id === updates.id);
  if (!team) return;
  Object.assign(team, pickTeamProperties(updates));
}

export function updateStaff(state: Draft<ActivityState>, activityId: string, staff: Record<string, string>): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity) return;
  activity.staff = {
    ...(activity.staff ?? {}),
    ...staff,
  };
}

// ---- Activity lifecycle ----------------------------------------------------

export function updateActivity(state: Draft<ActivityState>, updates: Partial<Activity>): void {
  let target = state.list.find((a) => a.id === updates.id);
  if (!target) {
    target = createNewActivity();
    state.list.push(target);
  }
  merge(target, pickActivityProperties(updates));
}

/**
 * Fill in the operations properties on an activity that is missing them.
 * Idempotent per-property: only unset (undefined) fields are seeded, so a second
 * OperationsDecorated event (e.g. from another client racing on load) is a no-op
 * and never clobbers real data.
 */
export function decorateOperations(state: Draft<ActivityState>, activityId: string, operations: OperationsSpecificFields): void {
  const activity = state.list.find((a) => a.id === activityId);
  if (!activity) return;
  if (!activity.teams) activity.teams = operations.teams;
  if (!activity.comms) activity.comms = operations.comms;
  if (!activity.staff) activity.staff = operations.staff;
  if (!activity.places) activity.places = operations.places;
}

export function removeActivity(state: Draft<ActivityState>, activityId: string): void {
  state.list = state.list.filter((f) => f.id !== activityId);
}

export function reactivateActivity(state: Draft<ActivityState>, activityId: string): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (activity) activity.endTime = undefined;
}

export function completeActivity(state: Draft<ActivityState>, activityId: string, endTime: number): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity) return;
  activity.endTime = endTime;
  // Sign every participant out at the end time.
  for (const pId in activity.participants) {
    const participant = activity.participants[pId];
    participantUpdate(
      state,
      activity.id,
      {
        id: participant.id,
        firstname: participant.firstname,
        lastname: participant.lastname,
        organizationId: participant.organizationId,
        miles: participant.miles,
        eta: participant.eta,
      },
      { time: endTime, status: ParticipantStatus.SignedOut },
    );
  }
}

export function appendOrganizationTimeline(
  state: Draft<ActivityState>,
  activityId: string,
  orgId: string,
  org: { id: string; title: string; rosterName?: string },
  status: { time: number; status: OrganizationStatus },
): void {
  const activity = state.list.find((f) => f.id === activityId);
  if (!activity) return;
  activity.organizations[orgId] = Object.assign(activity.organizations[orgId] ?? { timeline: [] }, org);
  activity.organizations[orgId].timeline.unshift(status);
}
