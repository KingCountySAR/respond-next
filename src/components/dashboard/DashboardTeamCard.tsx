import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Chip, Divider, IconButton, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { CommunicationsLogEntry, Participant, ParticipantStatus } from '@respond/types/activity';

import { EquipmentItem, Team, TeamStatus } from '../../types/team';
import { useActivityContext } from '../activities/ActivityProvider';
import { Droppable } from '../DragAndDrop/DnDComponents';
import { StatusContainer } from '../StatusContainer';

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
  const dispatch = useAppDispatch();

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
    dispatch(ActivityActions.updateTeam(activity.id, { ...team, teamLeaderParticipantId: newLeaderId }));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDrop = (item: any, type: string) => {
    if (type === 'participant') {
      addTeamMember(item);
    }
    if (type === 'equipment') {
      addEquipment(item);
    }
  };

  const addTeamMember = (participant: Participant) => {
    // If the item was dragged and dropped back to the same team, cancel.
    if (team.assignedParticipants.find((id) => id === participant.id)) return;
    // Update the Participant Status to Assigned
    if (participant.timeline[0].status !== ParticipantStatus.Assigned) {
      const update = { time: Date.now(), status: ParticipantStatus.Assigned, organizationId: participant.organizationId };
      dispatch(ActivityActions.participantTimelineAdd(activity.id, participant.id, update));
    }
    // Remove from the previous team, if any
    // TODO: need actions to club these updates into a single activity transaction
    activity.teams.forEach((team) => {
      if (team.assignedParticipants.includes(participant.id)) {
        // Remove the participant from the team
        const updatedTeam = { ...team, assignedParticipants: team.assignedParticipants.filter((id) => id !== participant.id) };
        dispatch(ActivityActions.updateTeam(activity.id, updatedTeam));
      }
    });
    // Update the Team to include the new participant
    const updatedTeam = { ...team, assignedParticipants: [...team.assignedParticipants, participant.id], teamLeaderParticipantId: team.teamLeaderParticipantId || participant.id };
    dispatch(ActivityActions.updateTeam(activity.id, updatedTeam));
  };

  const addEquipment = (equipment: EquipmentItem) => {
    // If the item was dragged and dropped back to the same team, cancel.
    if (team.assignedEquipment.find((item) => item.uuid === equipment.uuid)) return;
    // Remove from the previous team, if any
    // TODO: need actions to club these updates into a single activity transaction
    activity.teams.forEach((team) => {
      if (team.assignedEquipment.some((item) => item.uuid === equipment.uuid)) {
        // Remove the participant from the team
        const updatedTeam = { ...team, assignedEquipment: team.assignedEquipment.filter((item) => item.uuid !== equipment.uuid) };
        dispatch(ActivityActions.updateTeam(activity.id, updatedTeam));
      }
    });
    // Update the Team to include the new participant
    const updatedTeam = { ...team, assignedEquipment: [...team.assignedEquipment, equipment] };
    dispatch(ActivityActions.updateTeam(activity.id, updatedTeam));
  };

  const updateTeam = (team: Team) => {
    dispatch(ActivityActions.updateTeam(activity.id, team));
  };

  const logStatusChange = (from: string, status: TeamStatus) => {
    const messages = {
      'In Base': 'In Base',
      'In Transit': 'With Transportation',
      'On Assignment': 'Starting Assignment',
      'On Scene': 'On Scene',
      'Returning To Base': 'RTB',
    };
    const comm: CommunicationsLogEntry = {
      id: uuid(),
      from,
      to: 'CP',
      message: messages[status],
      timestamp: Date.now(),
      isAutomated: true,
      isDeleted: false,
    };
    dispatch(ActivityActions.addComm(activity.id, comm));
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
        <StatusContainer color={statusColor} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', borderRadius: 2, p: 1.5, bgcolor: 'background.paper', height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center">
                <IconButton onClick={handleExpandClick} size="small" sx={{ width: 32, height: 32 }}>
                  {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                </IconButton>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => setOpenTeamEditor(team)}>
                    {team.name}
                  </Typography>
                  {teamLeader && <DashboardTeamMember key={teamLeader.id} participant={teamLeader} />}
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <TeamStatusSelect
                  value={team.status}
                  onChange={(newStatus) => {
                    console.log(newStatus);
                    updateTeam({ ...team, status: newStatus });
                    logStatusChange(team.name, newStatus);
                  }}
                />
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
                        teamMembers.map((participant) => <DashboardTeamMember key={participant.id} participant={participant} onPromote={() => updateTeamLeader(participant.id)} />)
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
                        sortedTeamEquipment.map((item) => <DashboardTeamEquipment key={item.uuid} item={item} />)
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
        teams={activity.teams}
        onSave={(team) => {
          updateTeam(team);
          setOpenTeamEditor(null);
        }}
        onClose={() => setOpenTeamEditor(null)}
      />
    </>
  );
}
