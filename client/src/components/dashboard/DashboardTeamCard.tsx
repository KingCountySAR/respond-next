import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Chip, Divider, IconButton, Stack, Typography } from '@mui/material';
import { Participant, ParticipantStatus } from '@respond/shared/types/activity';
import { EquipmentItem, Team } from '@respond/shared/types/operations';
import { useEffect, useState } from 'react';

import { useTeamCommands } from '@respond/lib/client/services/teams';

import { useActivityContext } from '../activities/ActivityProvider';
import { Draggable, Droppable } from '../DragAndDrop/DnDComponents';
import { StatusContainer } from '../StatusContainer';

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

export default function DashboardTeamCard({ team, defaultExpanded }: { team: Team; defaultExpanded?: boolean }) {
  const teams = useTeamCommands();

  const activity = useActivityContext();

  const [openTeamEditor, setOpenTeamEditor] = useState<Team | null>(null);
  const [localExpanded, setLocalExpanded] = useState<boolean>(defaultExpanded ?? false);
  const isExpanded = localExpanded;

  useEffect(() => {
    if (defaultExpanded !== undefined) {
      setLocalExpanded(defaultExpanded);
    }
  }, [defaultExpanded]);

  const teamParticipants: Participant[] = Object.values(activity.participants).filter((participant) => team.assignedParticipants.includes(participant.id));
  const teamLeader: Participant | undefined = teamParticipants.find((participant) => participant.id === team.teamLeaderParticipantId);
  const teamMembers = teamParticipants.filter((participant) => participant.id !== team.teamLeaderParticipantId).sort(sortParicipantsAlphabetically);

  const sortedTeamEquipment = [...team.assignedEquipment].sort(sortEquipmentAlphabetically);

  const updateTeamLeader = (newLeaderId: string) => {
    teams.updateTeam(activity.id, { ...team, teamLeaderParticipantId: newLeaderId });
  };

  const hasTeamMemberError = teamParticipants.some((participant) => participant.timeline?.[0]?.status !== ParticipantStatus.Assigned);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDrop = (item: any, type: string, callback?: (...args: any[]) => void) => {
    if (type === 'participant') {
      // If the item was dragged and dropped back to the same team, cancel.
      if (team.assignedParticipants.includes(item.id)) return;
      addTeamMember(item);
    } else if (type === 'equipment') {
      if (!!callback && item.type === 'Custom' && item.name === 'Custom Item') {
        callback({ item, onSave: (newItem: EquipmentItem) => addEquipment(newItem) });
        return;
      }
      // If the item was dragged and dropped back to the same place, cancel.
      if (team.assignedEquipment.find((equipment) => item.uuid === equipment.uuid)) return;
      addEquipment(item);
    } else {
      return;
    }
    callback?.();
  };

  const addTeamMember = (participant: Participant) => {
    if (team.assignedParticipants.find((id) => id === participant.id)) return;
    // Update the Team to include the new participant
    const updatedTeam = { ...team, assignedParticipants: [...team.assignedParticipants, participant.id], teamLeaderParticipantId: team.teamLeaderParticipantId || participant.id };
    updateTeam(updatedTeam);
  };

  const removeTeamMember = (participantId: string) => {
    if (team.assignedParticipants.includes(participantId)) {
      // Remove the participant from the team
      const updatedTeam = { ...team, assignedParticipants: team.assignedParticipants.filter((id) => id !== participantId), teamLeaderParticipantId: team.teamLeaderParticipantId === participantId ? null : team.teamLeaderParticipantId };
      updateTeam(updatedTeam);
    }
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

  // The team-comms reactor logs the GAR-change comm server-side.
  const updateTeam = (team: Team) => {
    teams.updateTeam(activity.id, team);
  };

  const handleExpandClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setLocalExpanded((current) => !current);
  };

  const statusColor = {
    green: 'green',
    amber: 'goldenrod',
    red: 'darkred',
  }[team.gar];

  return (
    <>
      <Droppable accepts={['participant', 'equipment']} onDrop={handleDrop}>
        <StatusContainer color={team.status === 'Disbanded' ? 'grey' : statusColor} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', borderRadius: 2, p: 1, pl: 0.5, bgcolor: 'background.paper', height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center">
                <IconButton onClick={handleExpandClick} size="small" sx={{ width: 32, height: 32 }}>
                  {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                </IconButton>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => setOpenTeamEditor(team)}>
                    {team.name}
                  </Typography>
                  <DashboardErrorIndicator message={hasTeamMemberError ? 'One or more team members are not assigned to the activity.' : undefined} size={16} />
                  {teamLeader && (
                    <Draggable type="participant" item={teamLeader} callback={() => removeTeamMember(teamLeader.id)}>
                      <DashboardTeamMember key={teamLeader.id} participant={teamLeader} />
                    </Draggable>
                  )}
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <TeamStatusSelect team={team} />
                <Chip label={`${teamParticipants.length} members`} size="small" variant="outlined" />
              </Stack>
            </Stack>
            {isExpanded && (
              <>
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" spacing={1} sx={{ flex: 1, overflow: 'auto' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                      Team Members
                    </Typography>
                    <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                      {teamMembers.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                          None
                        </Typography>
                      ) : (
                        teamMembers.map((participant) => {
                          return (
                            <Draggable key={participant.id} type="participant" item={participant} callback={() => removeTeamMember(participant.id)}>
                              <DashboardTeamMember key={participant.id} participant={participant} onPromote={() => updateTeamLeader(participant.id)} />
                            </Draggable>
                          );
                        })
                      )}
                    </Stack>
                  </Box>
                  <Box sx={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      Details
                    </Typography>
                    <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                      <Typography variant="body2">GAR: {team.gar}</Typography>
                      {team.assignment && <Typography variant="body2">Assignment: {team.assignment}</Typography>}
                    </Stack>
                  </Box>
                  <Box sx={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ pr: 1 }}>
                      Equipment
                    </Typography>
                    <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                      {sortedTeamEquipment.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ pr: 1 }}>
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
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      Notes
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {team.notes}
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        </StatusContainer>
      </Droppable>
      <DashboardTeamEditDialog
        team={openTeamEditor}
        teams={activity.teams ?? []}
        onSave={(team) => {
          updateTeam(team);
          setOpenTeamEditor(null);
        }}
        onClose={() => setOpenTeamEditor(null)}
      />
    </>
  );
}
