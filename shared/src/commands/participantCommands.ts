import { ParticipantEvents } from '../events/participantEvents';
import { ParticipantUpdate } from '../types/activity';

import { defineCommand } from './defineCommand';

export const ParticipantCommands = {
  // `id` is minted server-side (see server commands.ts) — callers describe a new entry, not an existing one.
  AddParticipantTimeline: defineCommand('cmd/participant/timelineAdd', (activityId: string, participantId: string, update: Omit<ParticipantUpdate, 'id'>) => ({ payload: { activityId, participantId, update } })),

  CorrectParticipantTimeline: defineCommand(
    'cmd/participant/timelineUpdate',
    (activityId: string, participantId: string, update: ParticipantUpdate) => ({ payload: { activityId, participantId, update } }),
    ParticipantEvents.ParticipantTimelineCorrected,
  ),

  UpdateParticipantMiles: defineCommand(
    'cmd/participant/miles',
    (activityId: string, participantId: string, miles: number) => ({ payload: { activityId, participantId, miles } }),
    ParticipantEvents.ParticipantMilesUpdated,
  ),

  UpdateParticipantEta: defineCommand('cmd/participant/eta', (activityId: string, participantId: string, eta: number | null) => ({ payload: { activityId, participantId, eta } }), ParticipantEvents.ParticipantEtaUpdated),
};
