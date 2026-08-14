import { createAction } from '@reduxjs/toolkit';

import { ParticipantStatus, ParticipantUpdate } from '../types/activity';

// Facts about participants, minted by the server and broadcast to all clients.
// ParticipantTagged is authored by the participant-tag reactor.

type ParticipantIdentity = { id: string; firstname: string; lastname: string; organizationId: string; miles?: number; eta?: number };
type StatusUpdate = { id?: string; time: number; status: ParticipantStatus };

const ParticipantUpdated = createAction('evt/participant/updated', (activityId: string, participant: ParticipantIdentity, update: StatusUpdate) => ({
  payload: { activityId, participant, update },
}));

const ParticipantTimelineAdded = createAction('evt/participant/timelineAdded', (activityId: string, participantId: string, update: ParticipantUpdate) => ({
  payload: { activityId, participantId, update },
}));

const ParticipantTimelineUpdated = createAction('evt/participant/timelineUpdated', (activityId: string, participantId: string, update: ParticipantUpdate) => ({
  payload: { activityId, participantId, update },
}));

const ParticipantMilesUpdated = createAction('evt/participant/milesUpdated', (activityId: string, participantId: string, miles: number) => ({
  payload: { activityId, participantId, miles },
}));

const ParticipantEtaUpdated = createAction('evt/participant/etaUpdated', (activityId: string, participantId: string, eta: number | null) => ({
  payload: { activityId, participantId, eta },
}));

const ParticipantsBulkUpdated = createAction('evt/participant/bulkUpdated', (activityId: string, updates: Array<{ participantId: string; update: ParticipantUpdate }>) => ({
  payload: { activityId, updates },
}));

const ParticipantTagged = createAction('evt/participant/tagged', (activityId: string, participantId: string, tags: string[]) => ({
  payload: { activityId, participantId, tags },
}));

export const ParticipantEvents = {
  ParticipantUpdated,
  ParticipantTimelineAdded,
  ParticipantTimelineUpdated,
  ParticipantMilesUpdated,
  ParticipantEtaUpdated,
  ParticipantsBulkUpdated,
  ParticipantTagged,
};
