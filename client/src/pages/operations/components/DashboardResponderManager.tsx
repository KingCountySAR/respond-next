import { Box, Typography } from '@mui/material';
import { useEffect, useMemo } from 'react';

import { useParticipantCommands } from '@respond/lib/client/services/participants';
import { Participant } from '@respond/shared/types/activity';
import { ParticipantStatus } from '@respond/shared/types/activity';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';
import { Draggable, Droppable } from '@/client/components/DragAndDrop/DnDComponents';

import DashboardParticipantCard from './DashboardParticipantCard';

function sortParticipantsAlphabetically(left: Participant, right: Participant) {
  const leftName = `${left.firstname} ${left.lastname}`.trim();
  const rightName = `${right.firstname} ${right.lastname}`.trim();
  return leftName.localeCompare(rightName, undefined, { sensitivity: 'base' });
}

export function DashboardResponderManager({ availableCallback }: { availableCallback: (count: number) => void }) {
  const participants = useParticipantCommands();

  const activity = useActivityContext();

  const teams = useMemo(() => {
    return Object.values(activity.teams ?? []).filter((team) => team.status !== 'Disbanded');
  }, [activity]);

  const assignedParticipantIds = useMemo(() => {
    const assignedIds = new Set<string>();

    teams.forEach((team) => {
      team.assignedParticipants.forEach((id) => assignedIds.add(id));
    });

    (activity.places ?? []).forEach((place) => {
      (place.assignedParticipants ?? []).forEach((id) => assignedIds.add(id));
    });

    return assignedIds;
  }, [activity.places, teams]);

  const availableParticipants = useMemo(() => {
    return Object.values(activity.participants)
      .filter((participant) => {
        return participant.timeline[0].status === ParticipantStatus.Available && !assignedParticipantIds.has(participant.id);
      })
      .sort((a, b) => a.firstname.localeCompare(b.lastname));
  }, [activity.participants, assignedParticipantIds]);

  useEffect(() => {
    availableCallback?.(availableParticipants.length);
  }, [availableCallback, availableParticipants]);

  const signedInParticipants = useMemo(() => {
    return (
      Object.values(activity.participants)
        .filter((participant) => {
          return participant.timeline[0].status === ParticipantStatus.SignedIn && !assignedParticipantIds.has(participant.id);
        })
        // Signed-in responders are ordered by earliest ETA first; unknown ETA entries sort last and are alphabetized.
        .sort((left, right) => {
          const leftEta = left.eta;
          const rightEta = right.eta;

          if (leftEta == null && rightEta == null) {
            return sortParticipantsAlphabetically(left, right);
          }

          if (leftEta == null) {
            return 1;
          }

          if (rightEta == null) {
            return -1;
          }

          if (leftEta !== rightEta) {
            return leftEta - rightEta;
          }

          return sortParticipantsAlphabetically(left, right);
        })
    );
  }, [activity.participants, assignedParticipantIds]);

  const setAssigned = (isSelf: boolean, participant: Participant) => {
    if (isSelf) return; // If the participant is dragged from the Responders list to the Responders list, cancel.
    const update = { time: Date.now(), status: ParticipantStatus.Assigned, organizationId: participant.organizationId };
    participants.addTimeline(activity.id, participant.id, update);
  };

  const handleDrop = (participant: Participant, type: string, callback?: (isSelf: boolean) => void) => {
    // If the participant is not in Assigned status, do not overwrite the current status.
    if (participant.timeline[0].status === ParticipantStatus.Assigned) {
      // Update the Participant Status to Available
      const update = { time: Date.now(), status: ParticipantStatus.Available, organizationId: participant.organizationId };
      participants.addTimeline(activity.id, participant.id, update);
    }
    callback?.(true);
  };

  return (
    <Droppable accepts="participant" onDrop={handleDrop} grow>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {availableParticipants.length === 0 && signedInParticipants.length === 0 ? (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              All responders are assigned.
            </Typography>
          </Box>
        ) : (
          <>
            {availableParticipants.map((participant) => {
              return (
                <Draggable key={participant.id} type="participant" item={participant} callback={(isSelf: boolean) => setAssigned(isSelf, participant)}>
                  <DashboardParticipantCard key={participant.id} participant={participant} />
                </Draggable>
              );
            })}
            {signedInParticipants.map((participant) => (
              <DashboardParticipantCard key={participant.id} participant={participant} />
            ))}
          </>
        )}
      </Box>
    </Droppable>
  );
}
