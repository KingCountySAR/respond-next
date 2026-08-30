import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Chip, Divider, IconButton, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { useDialogs } from '@respond/components/DialogProvider';
import { useTeamCommands } from '@respond/lib/client/services/teams';
import { Participant, ParticipantStatus } from '@respond/shared/types/activity';
import { EquipmentItem, Team } from '@respond/shared/types/operations';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';
import { Draggable, Droppable } from '@/client/components/DragAndDrop/DnDComponents';
import { StatusContainer } from '@/client/components/StatusContainer';

import { DashboardErrorIndicator } from './DashboardErrorIndicator';
import { DashboardTeamEditDialog } from './DashboardTeamEditDialog';
import { DashboardTeamEquipment } from './DashboardTeamEquipment';
import { DashboardTeamMember } from './DashboardTeamMember';
import { TeamStatusSelect } from './DashboardTeamStatusSelect';

const sortParicipantsAlphabetically = (left: Participant, right: Participant) => {
  return `${left.firstname} ${left.lastname}`.localeCompare(`${right.firstname} ${right.lastname}`);
};

const sortEquipmentAlphabetically = (left: EquipmentItem, right: EquipmentItem) => {
  return left.name.localeCompare(right.name);
};

export default function DashboardTeamCard({ team, expandCommand, onExpandedChange }: { team: Team; expandCommand?: { expanded: boolean; nonce: number }; onExpandedChange?: (expanded: boolean) => void }) {
  const teams = useTeamCommands();
  const activity = useActivityContext();
  const { open } = useDialogs();

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const isDisbanded = team.status === 'Disbanded';

  useEffect(() => {
    if (expandCommand !== undefined) {
      setIsExpanded(expandCommand.expanded);
    }
  }, [expandCommand]);

  useEffect(() => {
    onExpandedChange?.(isExpanded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const teamParticipants = team.assignedParticipants.map((pId) => activity.participants[pId]);
  const teamLeader = teamParticipants[0];
  const teamMembers = teamParticipants.slice(1).sort(sortParicipantsAlphabetically);

  const sortedTeamEquipment = [...team.assignedEquipment].sort(sortEquipmentAlphabetically);

  const hasTeamMemberError = teamParticipants.some((participant) => participant.timeline?.[0]?.status !== ParticipantStatus.Assigned);

  const handleExpandedDrop = (item: Participant | EquipmentItem, type: string, callback?: (...args: unknown[]) => void, asLeader?: boolean) => {
    if (type === 'participant') {
      // If the item was dragged and dropped back to the same team (without changing leadership), cancel.
      if (team.assignedParticipants.includes(item.id)) {
        const isLeader = team.assignedParticipants[0] === item.id;
        if (isLeader === (asLeader ?? false)) return;
      }
      teams.assignTeamMember(activity.id, item.id, { type: 'team', id: team.id, asLeader });
    } else if (type === 'equipment') {
      const equipment = item as EquipmentItem;
      if (!!callback && equipment.type === 'Custom' && equipment.name === 'Custom Item') {
        callback({ item, onSave: (newItem: EquipmentItem) => addEquipment(newItem) });
        return;
      }
      // If the item was dragged and dropped back to the same place, cancel.
      if (team.assignedEquipment.find((e) => e.uuid === e.uuid)) return;
      addEquipment(equipment);
    } else {
      return;
    }
  };

  const handleHeaderDrop = (item: Participant | EquipmentItem, type: string, callback?: (...args: unknown[]) => void) => {
    handleExpandedDrop(item, type, callback, (type === 'participant' && isExpanded) || undefined);
  };

  const addEquipment = (equipment: EquipmentItem) => {
    // If the item was dragged and dropped back to the same team, cancel.
    if (team.assignedEquipment.find((item) => item.uuid === equipment.uuid)) return;
    // Update the Team to include the new participant
    const updatedTeam = { ...team, assignedEquipment: [...team.assignedEquipment, equipment] };
    updateTeam(updatedTeam);
  };

  const removeEquipment = (id: string) => {
    if (team.assignedEquipment.some((item) => item.uuid === id)) {
      // Remove the equipment from the team
      const updatedTeam = { ...team, assignedEquipment: team.assignedEquipment.filter((item) => item.uuid !== id) };
      updateTeam(updatedTeam);
    }
  };

  const editTeam = async () => {
    const result = await open(DashboardTeamEditDialog, { team, activity });
    if (result !== null) updateTeam(result);
  };

  // The team-comms reactor logs the GAR-change comm server-side.
  const updateTeam = (team: Team) => {
    teams.updateTeam(activity.id, team);
  };

  const handleExpandClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsExpanded((current) => !current);
  };

  const statusColor = {
    green: 'green',
    amber: 'goldenrod',
    red: 'darkred',
  }[team.gar];

  return (
    <>
      <StatusContainer color={team.status === 'Disbanded' ? 'grey' : statusColor} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', borderRadius: 2, p: 1, pl: 0.5, bgcolor: 'background.paper', height: '100%' }}>
          <Droppable accepts={isDisbanded ? [] : ['participant', 'equipment']} onDrop={handleHeaderDrop}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Stack direction="row" sx={{ alignItems: 'center' }}>
                <IconButton onClick={handleExpandClick} size="small" sx={{ width: 32, height: 32 }}>
                  {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                </IconButton>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, cursor: 'pointer', color: isDisbanded ? 'text.disabled' : undefined }} onClick={editTeam}>
                    {team.name}
                  </Typography>
                  <DashboardErrorIndicator message={hasTeamMemberError ? 'One or more team members are not assigned to the activity.' : undefined} size={16} />
                  {teamLeader && (
                    <Draggable type="participant" item={teamLeader}>
                      <DashboardTeamMember key={teamLeader.id} participant={teamLeader} />
                    </Draggable>
                  )}
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TeamStatusSelect team={team} />
                <Chip label={`${teamParticipants.length} members`} size="small" variant="outlined" />
              </Stack>
            </Stack>
          </Droppable>
          {isExpanded && (
            <Droppable accepts={isDisbanded ? [] : ['participant', 'equipment']} onDrop={handleExpandedDrop}>
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={1} sx={{ flex: 1, overflow: 'auto' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', pl: 1 }}>
                    Team Members
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                    {teamMembers.length === 0 ? (
                      <Typography variant="body2" sx={{ color: 'text.secondary', pl: 1 }}>
                        None
                      </Typography>
                    ) : (
                      teamMembers.map((participant) => {
                        return (
                          <Draggable key={participant.id} type="participant" item={participant}>
                            <DashboardTeamMember key={participant.id} participant={participant} />
                          </Draggable>
                        );
                      })
                    )}
                  </Stack>
                </Box>
                <Box sx={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Details
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                    <Typography variant="body2">GAR: {team.gar}</Typography>
                    {team.assignment && <Typography variant="body2">Assignment: {team.assignment}</Typography>}
                  </Stack>
                </Box>
                <Box sx={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', pr: 1 }}>
                    Equipment
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                    {sortedTeamEquipment.length === 0 ? (
                      <Typography variant="body2" sx={{ color: 'text.secondary', pr: 1 }}>
                        None
                      </Typography>
                    ) : (
                      sortedTeamEquipment.map((item) => {
                        return (
                          <Draggable
                            key={item.uuid}
                            type="equipment"
                            item={item}
                            callback={() => {
                              if (item.uuid) removeEquipment(item.uuid);
                            }}
                          >
                            <DashboardTeamEquipment key={item.uuid} item={item} />
                          </Draggable>
                        );
                      })
                    )}
                  </Stack>
                </Box>
              </Stack>
              {team.notes?.trim() && (
                <Box sx={{ width: '100%', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {team.notes}
                  </Typography>
                </Box>
              )}
            </Droppable>
          )}
        </Box>
      </StatusContainer>
    </>
  );
}
