import type { Draft } from '@reduxjs/toolkit';

import { createNewActivity } from '../types/activity';
import { CommunicationsLogEntry, Place } from '../types/operations';

import { ActivityState } from '.';

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
  // guard against sync replay applying the same entry twice
  if (activity.comms.some((c) => c.id === comm.id)) return;
  activity.comms.push(comm);
}

export function updateComm(state: Draft<ActivityState>, activityId: string, commId: string, updates: Partial<CommunicationsLogEntry>): void {
  const activity = state.list.find((a) => a.id === activityId);
  if (!activity || !activity.comms) return;
  const comm = activity.comms.find((entry) => entry.id === commId);
  if (!comm) return;
  Object.assign(comm, updates);
}
