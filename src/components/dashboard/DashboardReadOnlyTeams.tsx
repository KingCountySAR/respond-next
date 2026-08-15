import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Divider, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import { Participant } from '@respond/types/activity';
import { EquipmentItem, Team } from '@respond/types/operations';

import { useActivityContext } from '../activities/ActivityProvider';
import { StatusContainer } from '../StatusContainer';

import { sortTeams } from './DashboardTeamManager';

const sortParicipantsAlphabetically = (left: Participant, right: Participant) => {
  return `${left.firstname} ${left.lastname}`.localeCompare(`${right.firstname} ${right.lastname}`);
};

const sortEquipmentAlphabetically = (left: EquipmentItem, right: EquipmentItem) => {
  return left.name.localeCompare(right.name);
};

export function DashboardReadOnlyTeams() {
  const activity = useActivityContext();

  const teams = activity.teams ?? [];

  return (
    <Paper variant="outlined" sx={{ p: 1, borderRadius: 2, flex: 1, minWidth: 180 }}>
      <Stack spacing={1}>
        {teams.length ? (
          [...teams].sort(sortTeams).map((team) => {
            return <DashboardReadOnlyTeamCard key={team.id} team={team} />;
          })
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              There are no active teams.
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

function DashboardReadOnlyTeamCard({ team }: { team: Team }) {
  const activity = useActivityContext();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const teamParticipants: Participant[] = Object.values(activity.participants).filter((participant) => team.assignedParticipants.includes(participant.id));
  const teamLeader: Participant | undefined = teamParticipants.find((participant) => participant.id === team.teamLeaderParticipantId);
  const teamMembers = teamParticipants.filter((participant) => participant.id !== team.teamLeaderParticipantId).sort(sortParicipantsAlphabetically);

  const sortedTeamEquipment = [...team.assignedEquipment].sort(sortEquipmentAlphabetically);

  const statusColor = {
    green: 'green',
    amber: 'goldenrod',
    red: 'darkred',
  }[team.gar];

  return (
    <Box>
      <StatusContainer color={team.status === 'Disbanded' ? 'grey' : statusColor} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', borderRadius: 2, p: 1, pl: 0.5, bgcolor: 'background.paper', height: '100%' }} onClick={() => setIsExpanded((prev) => !prev)}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center">
              <IconButton onClick={() => setIsExpanded((prev) => !prev)} size="small" sx={{ width: 32, height: 32 }}>
                {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              </IconButton>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 700, cursor: 'pointer' }}>
                  {team.name}
                </Typography>
                {!!teamLeader && <Typography variant="body2" color="text.secondary">{`${teamLeader.firstname} ${teamLeader.lastname}`}</Typography>}
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" fontSize={'14px'}>
                {team.status}
              </Typography>
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
                  <Stack spacing={0.75} sx={{ mt: 0.5, p: 1 }}>
                    {teamMembers.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                        None
                      </Typography>
                    ) : (
                      teamMembers.map((participant) => {
                        return <Typography key={participant.id} variant="body2" color="text.secondary">{`${participant.firstname} ${participant.lastname}`}</Typography>;
                      })
                    )}
                  </Stack>
                </Box>
                <Box sx={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    Details
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5, p: 1 }}>
                    <Typography variant="body2">GAR: {team.gar}</Typography>
                    {team.assignment && <Typography variant="body2">Assignment: {team.assignment}</Typography>}
                  </Stack>
                </Box>
                <Box sx={{ textAlign: 'right', flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ pr: 1 }}>
                    Equipment
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5, p: 1 }}>
                    {sortedTeamEquipment.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ pr: 1 }}>
                        None
                      </Typography>
                    ) : (
                      sortedTeamEquipment.map((item) => {
                        return (
                          <Typography key={item.uuid} variant="body2" color="text.secondary">
                            {item.name}
                          </Typography>
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
    </Box>
  );
}
