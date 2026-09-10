import { ActivityCommands, CommsCommands, GroupCommands, ParticipantCommands, PlaceCommands, ResourceCommands, TeamCommands } from '@respond/shared/commands';

import { useCommands } from './useCommands';

export const useCommsCommands = (activityId: string) => useCommands(CommsCommands, activityId);

export function useActivityCommands() {
  const commands = useCommands(ActivityCommands);
  return {
    update: commands.updateActivity,
    remove: commands.removeActivity,
    complete: commands.completeActivity,
    reactivate: commands.reactivateActivity,
    appendOrganizationTimeline: commands.appendOrganizationTimeline,
    decorateOperations: commands.decorateOperations,
  };
}

export function useParticipantCommands(activityId: string) {
  const commands = useCommands(ParticipantCommands, activityId);
  return {
    update: commands.updateParticipant,
    addTimeline: commands.addParticipantTimeline,
    updateTimeline: commands.updateParticipantTimeline,
    updateMiles: commands.updateParticipantMiles,
    updateEta: commands.updateParticipantEta,
    bulkUpdate: commands.bulkUpdateParticipants,
  };
}

export const usePlaceCommands = (activityId: string) => useCommands(PlaceCommands, activityId);

export const useTeamCommands = (activityId: string) => useCommands(TeamCommands, activityId);

export const useGroupCommands = (activityId: string) => useCommands(GroupCommands, activityId);

/** Moving a participant or piece of equipment to a team, place, group, or nowhere. */
export const useResourceCommands = (activityId: string) => useCommands(ResourceCommands, activityId);
