import { Box, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getOrganizationName, Participant } from '@respond/shared/types/activity';
import { ParticipantStatus } from '@respond/shared/types/activity';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';
import { Draggable } from '@/client/components/DragAndDrop/DnDComponents';

import DashboardParticipantCard from './DashboardParticipantCard';
import { DashboardSearchBox } from './DashboardSearchBox';

function sortParticipantsAlphabetically(left: Participant, right: Participant) {
  const leftName = `${left.firstname} ${left.lastname}`.trim();
  const rightName = `${right.firstname} ${right.lastname}`.trim();
  return leftName.localeCompare(rightName, undefined, { sensitivity: 'base' });
}

export function DashboardResponderManager({ availableCallback }: { availableCallback: (count: number) => void }) {
  const activity = useActivityContext();

  const teams = useMemo(() => activity.teams?.filter((team) => team.status !== 'Disbanded') ?? [], [activity]);
  const [searchQuery, setSearchQuery] = useState('');

  const matchesParticipantSearch = useCallback(
    (participant: Participant) => {
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (!normalizedQuery) return true;

      const searchableText = [participant.firstname, participant.lastname, getOrganizationName(activity, participant.organizationId), ...(participant.tags ?? [])].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(normalizedQuery);
    },
    [activity, searchQuery],
  );

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
        return participant.timeline[0].status === ParticipantStatus.Available && !assignedParticipantIds.has(participant.id) && matchesParticipantSearch(participant);
      })
      .sort(sortParticipantsAlphabetically);
  }, [activity.participants, assignedParticipantIds, matchesParticipantSearch]);

  useEffect(() => {
    availableCallback?.(availableParticipants.length);
  }, [availableCallback, availableParticipants]);

  const signedInParticipants = useMemo(() => {
    return (
      Object.values(activity.participants)
        .filter((participant) => {
          return participant.timeline[0].status === ParticipantStatus.SignedIn && !assignedParticipantIds.has(participant.id) && matchesParticipantSearch(participant);
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
  }, [activity.participants, assignedParticipantIds, matchesParticipantSearch]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <DashboardSearchBox onChange={setSearchQuery} />
      {availableParticipants.length === 0 && signedInParticipants.length === 0 ? (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            All responders are assigned.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1} sx={{ overflow: 'auto' }}>
          {availableParticipants.map((participant) => {
            return (
              <Draggable key={participant.id} type="participant" item={participant}>
                <DashboardParticipantCard participant={participant} />
              </Draggable>
            );
          })}
          {signedInParticipants.map((participant) => (
            <DashboardParticipantCard key={participant.id} participant={participant} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
