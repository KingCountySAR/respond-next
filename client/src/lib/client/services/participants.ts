import { ParticipantCommands } from '@respond/shared/commands';
import { ParticipantStatus, ParticipantUpdate } from '@respond/shared/types/activity';

import { useAppDispatch } from '../store';

/**
 * Participants service (Phase 2). Components dispatch commands; ClientSync
 * forwards them and applies the authoritative events. Tagging happens
 * server-side via the participant-tag reactor — no client involvement.
 */
export function useParticipantCommands() {
  const dispatch = useAppDispatch();

  return {
    update: (activityId: string, participantId: string, firstname: string, lastname: string, organizationId: string, time: number, status: ParticipantStatus, miles?: number, eta?: number) =>
      dispatch(ParticipantCommands.UpdateParticipant(activityId, participantId, firstname, lastname, organizationId, time, status, miles, eta)),
    addTimeline: (activityId: string, participantId: string, update: ParticipantUpdate) => dispatch(ParticipantCommands.AddParticipantTimeline(activityId, participantId, update)),
    updateTimeline: (activityId: string, participantId: string, update: ParticipantUpdate, index: number) => dispatch(ParticipantCommands.UpdateParticipantTimeline(activityId, participantId, update, index)),
    updateMiles: (activityId: string, participantId: string, miles: number) => dispatch(ParticipantCommands.UpdateParticipantMiles(activityId, participantId, miles)),
    updateEta: (activityId: string, participantId: string, eta: number) => dispatch(ParticipantCommands.UpdateParticipantEta(activityId, participantId, eta)),
    bulkUpdate: (activityId: string, updates: Array<{ participantId: string; update: ParticipantUpdate }>) => dispatch(ParticipantCommands.BulkUpdateParticipants(activityId, updates)),
  };
}
