import type { Draft } from '@reduxjs/toolkit';

import type { ActivityState } from '..';
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
      if (!activity) return;
      activity.places = [...(activity.places ?? []), place];
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
};
