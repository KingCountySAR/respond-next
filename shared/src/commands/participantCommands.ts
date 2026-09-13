import { ParticipantEvents } from '../events/participantEvents';
import { ParticipantUpdate } from '../types/activity';

import { defineCommand } from './defineCommand';

export const ParticipantCommands = {
  // `id` is minted server-side (see server commands.ts) — callers describe a new entry, not an existing one.
  AddParticipantTimeline: defineCommand('cmd/participant/addTimeline', (activityId: string, participantId: string, update: Omit<ParticipantUpdate, 'id'>) => ({ payload: { activityId, participantId, update } })),

  CorrectParticipantTimeline: defineCommand(
    'cmd/participant/correctTimeline',
    (activityId: string, participantId: string, update: ParticipantUpdate) => ({ payload: { activityId, participantId, update } }),
    ParticipantEvents.ParticipantTimelineCorrected,
  ),

  UpdateParticipantMiles: defineCommand(
    'cmd/participant/updateMiles',
    (activityId: string, participantId: string, miles: number) => ({ payload: { activityId, participantId, miles } }),
    ParticipantEvents.ParticipantMilesUpdated,
  ),

  UpdateParticipantEta: defineCommand(
    'cmd/participant/updateEta',
    (activityId: string, participantId: string, eta: number | null) => ({ payload: { activityId, participantId, eta } }),
    ParticipantEvents.ParticipantEtaUpdated,
  ),
};
