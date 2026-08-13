import { createAction } from '@reduxjs/toolkit';

import { ParticipantStatus, ParticipantUpdate } from '../types/activity';

// Intent to change participant state, client -> server (except TagParticipant,
// which the participant-tag reactor emits server-side). Signatures mirror the
// legacy participant actions so client call sites migrate 1:1.

const UpdateParticipant = createAction(
  'cmd/participant/update',
  (activityId: string, participantId: string, firstname: string, lastname: string, organizationId: string, time: number, status: ParticipantStatus, miles?: number, eta?: number) => ({
    payload: {
      activityId,
      participant: { id: participantId, firstname, lastname, organizationId, miles, eta },
      update: { time, status },
    },
  }),
);

const AddParticipantTimeline = createAction('cmd/participant/timelineAdd', (activityId: string, participantId: string, update: ParticipantUpdate) => ({
  payload: { activityId, participantId, update },
}));

const UpdateParticipantTimeline = createAction('cmd/participant/timelineUpdate', (activityId: string, participantId: string, update: ParticipantUpdate, index: number) => ({
  payload: { activityId, participantId, update, index },
}));

const UpdateParticipantMiles = createAction('cmd/participant/miles', (activityId: string, participantId: string, miles: number) => ({
  payload: { activityId, participantId, miles },
}));

const UpdateParticipantEta = createAction('cmd/participant/eta', (activityId: string, participantId: string, eta: number | null) => ({
  payload: { activityId, participantId, eta },
}));

const BulkUpdateParticipants = createAction('cmd/participant/bulkUpdate', (activityId: string, updates: Array<{ participantId: string; update: ParticipantUpdate }>) => ({
  payload: { activityId, updates },
}));

const TagParticipant = createAction('cmd/participant/tag', (activityId: string, participantId: string, tags: string[]) => ({
  payload: { activityId, participantId, tags },
}));

export const ParticipantCommands = {
  UpdateParticipant,
  AddParticipantTimeline,
  UpdateParticipantTimeline,
  UpdateParticipantMiles,
  UpdateParticipantEta,
  BulkUpdateParticipants,
  TagParticipant,
};
