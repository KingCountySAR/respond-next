import type { Draft } from '@reduxjs/toolkit';

import type { ActivityState } from '..';
import { ParticipantStatus, ParticipantUpdate } from '../types/activity';

import { defineEvent } from './defineEvent';

// Facts about participants, minted by the server and broadcast to all clients.
// ParticipantTagged is authored by the participant-tag reactor.

export type ParticipantIdentity = { id: string; firstname: string; lastname: string; organizationId: string; miles?: number; eta?: number };
export type StatusUpdate = { id?: string; time: number; status: ParticipantStatus };
export type ParticipantUpdatedPayload = { activityId: string; participant: ParticipantIdentity; update: StatusUpdate };
export type ParticipantTimelinePayload = { activityId: string; participantId: string; update: ParticipantUpdate };

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

/**
 * Standalone (not inlined into defineEvent) because it's both ParticipantUpdated's
 * reduce AND called directly from activityEvents.ts's ActivityCompleted reduce.
 */
export function participantUpdate(state: Draft<ActivityState>, { payload }: { payload: ParticipantUpdatedPayload }) {
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
}

export const ParticipantEvents = {
  ParticipantUpdated: defineEvent(
    //
    'evt/participant/updated',
    (state: Draft<ActivityState>, payload: ParticipantUpdatedPayload) => participantUpdate(state, { payload }),
  ),

  ParticipantTimelineAdded: defineEvent(
    //
    'evt/participant/timelineAdded',
    (state: Draft<ActivityState>, { activityId, participantId, update }: ParticipantTimelinePayload) => {
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
  ),

  ParticipantTimelineUpdated: defineEvent(
    //
    'evt/participant/timelineUpdated',
    (state: Draft<ActivityState>, { activityId, participantId, update }: ParticipantTimelinePayload) => {
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
  ),

  ParticipantMilesUpdated: defineEvent(
    //
    'evt/participant/milesUpdated',
    (state: Draft<ActivityState>, { activityId, participantId, miles }: { activityId: string; participantId: string; miles: number }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      const person = activity.participants[participantId];
      if (!person) return;
      person.miles = miles;
    },
  ),

  ParticipantEtaUpdated: defineEvent(
    //
    'evt/participant/etaUpdated',
    (state: Draft<ActivityState>, { activityId, participantId, eta }: { activityId: string; participantId: string; eta: number | null }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      const person = activity.participants[participantId];
      if (!person) return;
      // null clears the ETA — normalize to undefined so Participant.eta stays number | undefined.
      person.eta = eta ?? undefined;
    },
  ),

  ParticipantTagged: defineEvent(
    //
    'evt/participant/tagged',
    (state: Draft<ActivityState>, { activityId, participantId, tags }: { activityId: string; participantId: string; tags: string[] }) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      const person = activity.participants[participantId];
      if (!person) return;
      person.tags = tags;
    },
  ),
};
