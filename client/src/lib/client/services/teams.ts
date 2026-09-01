import { TeamCommands } from '@respond/shared/commands';
import { AssignmentTarget, EquipmentItem, Team } from '@respond/shared/types/operations';

import { useAppDispatch } from '../store';

/**
 * Teams service (Phase 2). Components dispatch commands; ClientSync forwards
 * them and applies the events. Status/GAR/assignment comms are logged
 * server-side by the team-comms reactor — components no longer author them.
 */
export function useTeamCommands() {
  const dispatch = useAppDispatch();

  return {
    createTeam: (activityId: string, team: Team) => dispatch(TeamCommands.CreateTeam(activityId, team)),
    updateTeam: (activityId: string, updates: Partial<Team> & { id: string }) => dispatch(TeamCommands.UpdateTeam(activityId, updates)),
    deleteTeam: (activityId: string, id: string) => dispatch(TeamCommands.DeleteTeam(activityId, id)),
    updateStaff: (activityId: string, staff: Record<string, string>) => dispatch(TeamCommands.UpdateStaff(activityId, staff)),
    assignTeamMember: (activityId: string, participantId: string, target?: AssignmentTarget) => dispatch(TeamCommands.AssignTeamMember(activityId, participantId, target)),
    assignEquipment: (activityId: string, item: EquipmentItem, target?: AssignmentTarget) => dispatch(TeamCommands.AssignEquipment(activityId, item, target)),
  };
}
