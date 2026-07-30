import { Box, Typography } from '@mui/material';
import { useMemo } from 'react';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { Participant } from '@respond/types/activity';
import { ParticipantStatus } from '@respond/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';
import { Droppable } from '../DragAndDrop/DnDComponents';

import DashboardParticipantCard from './DashboardParticipantCard';

export function DashboardAvailableParticipants() {
  const dispatch = useAppDispatch();

  const activity = useActivityContext();

  const availableParticipants = useMemo(() => {
    return Object.values(activity.participants).filter((participant) => participant.timeline[0].status === ParticipantStatus.Available);
  }, [activity]);

  const handleDrop = (participant: Participant) => {
    if (participant.timeline[0].status !== ParticipantStatus.Available) {
      // Update the Participant Status to Available
      const update = { time: Date.now(), status: ParticipantStatus.Available, organizationId: participant.organizationId };
      dispatch(ActivityActions.participantTimelineAdd(activity.id, participant.id, update));
    }
    activity.teams.forEach((team) => {
      if (team.assignedParticipants.includes(participant.id)) {
        // Remove the participant from the team
        const updatedTeam = { ...team, assignedParticipants: team.assignedParticipants.filter((id) => id !== participant.id) };
        dispatch(ActivityActions.updateTeam(activity.id, updatedTeam));
      }
    });
  };

  return (
    <Droppable accepts="participant" onDrop={handleDrop} grow>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {availableParticipants.length === 0 ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              All responders are assigned.
            </Typography>
          </Box>
        ) : (
          availableParticipants.map((participant) => <DashboardParticipantCard key={participant.id} participant={participant} />)
        )}
      </Box>
    </Droppable>
  );
}
