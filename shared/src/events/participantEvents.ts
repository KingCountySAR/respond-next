import type { Draft } from '@reduxjs/toolkit';

import type { ActivityState } from '..';
import { ParticipantUpdate } from '../types/activity';

import { defineEvent } from './defineEvent';

// Facts about participants, minted by the server and broadcast to all clients.

export type ParticipantTimelinePayload = {
  activityId: string;
  participantId: string;
  update: ParticipantUpdate;
  // Identity + org-specific tags, resolved from the member provider. Required
  // the first time a participant appears in this activity, and again on an
  // org switch (tags are org-specific, so the old org's don't carry over —
  // see server/src/commands.ts). Omitted on any other entry.
  participant?: { firstname: string; lastname: string; tags: string[] };
};

export const ParticipantEvents = {
  ParticipantTimelineAdded: defineEvent(
    //
    'evt/participant/timelineAdded',
    (state: Draft<ActivityState>, { activityId, participantId, update, participant }: ParticipantTimelinePayload) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      let person = activity.participants[participantId];
      if (!person) {
        if (!participant) return; // handler always supplies identity on first appearance — a missing one here is a bug upstream, not a recoverable case.
        person = { id: participantId, firstname: participant.firstname, lastname: participant.lastname, organizationId: update.organizationId, tags: participant.tags, timeline: [] };
        activity.participants[participantId] = person;
      } else if (participant) {
        // Org switch: replace with the freshly-resolved identity + tags (the handler only
        // supplies `participant` here when the org actually changed).
        person.firstname = participant.firstname;
        person.lastname = participant.lastname;
        person.tags = participant.tags;
      }
      person.organizationId = update.organizationId;
      person.timeline.unshift(update);
    },
  ),

  ParticipantTimelineCorrected: defineEvent(
    //
    'evt/participant/timelineCorrected',
    (state: Draft<ActivityState>, { activityId, participantId, update }: ParticipantTimelinePayload) => {
      const activity = state.list.find((f) => f.id === activityId);
      if (!activity) return;
      const person = activity.participants[participantId];
      if (!person) return;
      const index = person.timeline.findIndex((entry) => entry.id === update.id);
      if (index < 0) return;
      person.timeline[index] = update;
      // Correcting an entry can change organizationId; re-sync from the timeline's
      // actual front (unaffected if the edited entry wasn't the latest one).
      person.organizationId = person.timeline[0].organizationId;
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
};
