import type { Draft } from '@reduxjs/toolkit';

import type { ActivityState } from '..';
import { createNewActivity } from '../types/activity';
import { AssignmentTarget, Place } from '../types/operations';

import { defineEvent } from './defineEvent';

// Facts about places, minted by the server and broadcast to all clients.

export type PlacePayload = { activityId: string; place: Place };

export const PlaceEvents = {
  PlaceCreated: defineEvent(
    //
    'evt/place/created',
    (state: Draft<ActivityState>, { activityId, place }: PlacePayload) => {
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
  ),

  PlaceUpdated: defineEvent(
    //
    'evt/place/updated',
    (state: Draft<ActivityState>, { activityId, place }: PlacePayload) => {
      const activity = state.list.find((a) => a.id === activityId);
      if (!activity) return;
      activity.places = (activity.places ?? []).map((p) => (p.id === place.id ? place : p));
    },
  ),

  // `target` is threaded through but not consumed here — reassigning the
  // place's participants/equipment happens via a follow-up reactor emitting
  // ResourceCommands, not directly in this reducer.
  PlaceDeleted: defineEvent(
    //
    'evt/place/deleted',
    (state: Draft<ActivityState>, { activityId, placeId }: { activityId: string; placeId: string; target: AssignmentTarget }) => {
      const activity = state.list.find((a) => a.id === activityId);
      if (!activity) return;
      activity.places = (activity.places ?? []).filter((p) => p.id !== placeId);
    },
  ),

  PlacesBatchChanged: defineEvent(
    //
    'evt/place/batchChanged',
    (state: Draft<ActivityState>, { activityId, deleteIds, upserts }: { activityId: string; upserts: Place[]; deleteIds: string[]; target: AssignmentTarget }) => {
      const activity = state.list.find((a) => a.id === activityId);
      if (!activity) return;
      const deleteSet = new Set(deleteIds);
      const upsertMap = new Map(upserts.map((p) => [p.id, p]));
      const kept = (activity.places ?? []).filter((p) => !deleteSet.has(p.id)).map((p) => upsertMap.get(p.id) ?? p);
      const created = upserts.filter((p) => !(activity.places ?? []).some((existing) => existing.id === p.id));
      activity.places = [...kept, ...created];
    },
  ),
};
