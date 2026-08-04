import { Box, Typography } from '@mui/material';
import { useMemo } from 'react';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { Participant } from '@respond/types/activity';
import { ParticipantStatus } from '@respond/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';
import { Draggable, Droppable } from '../DragAndDrop/DnDComponents';

import DashboardParticipantCard from './DashboardParticipantCard';

export function DashboardAvailableParticipants() {
  const dispatch = useAppDispatch();

  const activity = useActivityContext();

  const availableParticipants = useMemo(() => {
    return Object.values(activity.participants).filter((participant) => participant.timeline[0].status === ParticipantStatus.Available);
  }, [activity]);

  const setAssigned = (participant: Participant) => {
    const update = { time: Date.now(), status: ParticipantStatus.Assigned, organizationId: participant.organizationId };
    dispatch(ActivityActions.participantTimelineAdd(activity.id, participant.id, update));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDrop = (participant: Participant, type: string, callback?: () => void) => {
    // If the participant is not in Assigned status, do not overwrite the current status.
    if (participant.timeline[0].status !== ParticipantStatus.Assigned) return;
    // Update the Participant Status to Available
    const update = { time: Date.now(), status: ParticipantStatus.Available, organizationId: participant.organizationId };
    dispatch(ActivityActions.participantTimelineAdd(activity.id, participant.id, update));
    callback?.();
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
          availableParticipants.map((participant) => {
            return (
              <Draggable key={participant.id} type="participant" item={participant} callback={() => setAssigned(participant)}>
                <DashboardParticipantCard key={participant.id} participant={participant} />
              </Draggable>
            );
          })
        )}
      </Box>
    </Droppable>
  );
}
