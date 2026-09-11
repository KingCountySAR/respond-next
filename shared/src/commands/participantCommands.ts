import { ParticipantEvents } from '../events/participantEvents';
import { ParticipantStatus, ParticipantUpdate } from '../types/activity';

import { defineCommand } from './defineCommand';

export const ParticipantCommands = {
  UpdateParticipant: defineCommand(
    'cmd/participant/update',
    (activityId: string, participantId: string, firstname: string, lastname: string, organizationId: string, time: number, status: ParticipantStatus, miles?: number, eta?: number) => ({
      payload: {
        activityId,
        participant: { id: participantId, firstname, lastname, organizationId, miles, eta },
        update: { time, status },
      },
    }),
  ),

  AddParticipantTimeline: defineCommand('cmd/participant/timelineAdd', (activityId: string, participantId: string, update: ParticipantUpdate) => ({ payload: { activityId, participantId, update } })),

  UpdateParticipantTimeline: defineCommand(
    'cmd/participant/timelineUpdate',
    (activityId: string, participantId: string, update: ParticipantUpdate) => ({ payload: { activityId, participantId, update } }),
    ParticipantEvents.ParticipantTimelineUpdated,
  ),

  UpdateParticipantMiles: defineCommand(
    'cmd/participant/miles',
    (activityId: string, participantId: string, miles: number) => ({ payload: { activityId, participantId, miles } }),
    ParticipantEvents.ParticipantMilesUpdated,
  ),

  UpdateParticipantEta: defineCommand('cmd/participant/eta', (activityId: string, participantId: string, eta: number | null) => ({ payload: { activityId, participantId, eta } }), ParticipantEvents.ParticipantEtaUpdated),

  TagParticipant: defineCommand('cmd/participant/tag', (activityId: string, participantId: string, tags: string[]) => ({ payload: { activityId, participantId, tags } }), ParticipantEvents.ParticipantTagged),
};
