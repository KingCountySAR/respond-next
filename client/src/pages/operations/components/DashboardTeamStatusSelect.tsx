import { Box, Chip, MenuItem, Select, SelectChangeEvent } from '@mui/material';
import React from 'react';

import { useParticipantCommands } from '@respond/lib/client/services/participants';
import { usePlaceCommands } from '@respond/lib/client/services/places';
import { useTeamCommands } from '@respond/lib/client/services/teams';
import { ParticipantStatus } from '@respond/shared/types/activity';
import { createNewPlace, DEFAULT_PLACES, Team, TeamStatus } from '@respond/shared/types/operations';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';
import { useDialogs } from '@/client/components/DialogProvider';

const TEAM_STATUSES: TeamStatus[] = ['In Base', 'In Transit', 'On Assignment', 'On Scene', 'Returning To Base', 'Disbanded'];

// Color mapping for status visual indicators
const STATUS_COLORS: Record<TeamStatus, 'default' | 'info' | 'warning' | 'success' | 'secondary'> = {
  'In Base': 'default',
  'In Transit': 'info',
  'On Assignment': 'warning',
  'On Scene': 'success',
  'Returning To Base': 'secondary',
  Disbanded: 'default',
};

interface TeamStatusSelectProps {
  team: Team;
  label?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}

export const TeamStatusSelect: React.FC<TeamStatusSelectProps> = ({ team }) => {
  const participants = useParticipantCommands();
  const places = usePlaceCommands();
  const teams = useTeamCommands();
  const activity = useActivityContext();
  const { confirm } = useDialogs();

  // Status-change comms are logged server-side by the team-comms reactor.

  const disbandDirectly = () => {
    const updates = team.assignedParticipants
      .map((participantId) => {
        const participant = activity.participants[participantId];
        if (!participant) {
          return undefined;
        }
        return {
          participantId,
          update: {
            time: Date.now(),
            status: ParticipantStatus.Available,
            organizationId: participant.organizationId,
          },
        };
      })
      .filter((item): item is { participantId: string; update: { time: number; status: ParticipantStatus; organizationId: string } } => Boolean(item));

    if (updates.length) {
      participants.bulkUpdate(activity.id, updates);
    }

    teams.updateTeam(activity.id, {
      ...team,
      status: 'Disbanded',
      assignedParticipants: [],
      assignedEquipment: [],
    });
  };

  const disbandWithReassign = async () => {
    const confirmed = await confirm({
      prompt: `Disbanding ${team.name} will move remaining members and equipment to ${DEFAULT_PLACES.field}. Continue?`,
      destructive: true,
      label: 'Disband',
    });
    if (!confirmed) return;

    const fieldPlace = activity.places?.find((place) => place.name === DEFAULT_PLACES.field);
    const mergedParticipants = Array.from(new Set([...(fieldPlace?.assignedParticipants ?? []), ...team.assignedParticipants]));
    const existingEquipmentIds = new Set((fieldPlace?.assignedEquipment ?? []).map((item) => item.uuid));
    const mergedEquipment = [...(fieldPlace?.assignedEquipment ?? []), ...team.assignedEquipment.filter((item) => !existingEquipmentIds.has(item.uuid))];

    const updatedFieldPlace = fieldPlace
      ? {
          ...fieldPlace,
          assignedParticipants: mergedParticipants,
          assignedEquipment: mergedEquipment,
        }
      : {
          ...createNewPlace(DEFAULT_PLACES.field),
          assignedParticipants: mergedParticipants,
          assignedEquipment: mergedEquipment,
        };

    // The field place is a default place, so the place-comms reactor skips it —
    // moving resources into it logs no comm.
    if (fieldPlace) {
      places.updatePlace(activity.id, updatedFieldPlace);
    } else {
      places.createPlace(activity.id, updatedFieldPlace);
    }

    teams.updateTeam(activity.id, {
      ...team,
      status: 'Disbanded',
      assignedParticipants: [],
      assignedEquipment: [],
    });
  };

  const handleChange = (event: SelectChangeEvent<string>) => {
    const newStatus = event.target.value as TeamStatus;
    if (newStatus !== 'Disbanded') {
      teams.updateTeam(activity.id, { ...team, status: newStatus });
      return;
    }

    if (team.status === 'Disbanded') {
      return;
    }

    const isSafeDisband = team.status === 'In Base' || team.status === 'Returning To Base';
    const needsConfirm = !isSafeDisband && (team.assignedParticipants.length > 0 || team.assignedEquipment.length > 0);

    if (isSafeDisband) {
      disbandDirectly();
      return;
    }

    if (needsConfirm) {
      disbandWithReassign();
      return;
    }

    teams.updateTeam(activity.id, {
      ...team,
      status: 'Disbanded',
    });
  };

  return (
    <>
      <Select
        value={team.status}
        onChange={handleChange}
        variant="outlined"
        size="small"
        sx={{
          borderRadius: '16px', // Pill shape
          height: 28,
          fontSize: '0.75rem',
          fontWeight: 600,
          '& .MuiOutlinedInput-notchedOutline': {
            border: 'none', // Removes the standard input border box
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            border: 'none',
          },
          '& .MuiSelect-select': {
            paddingLeft: '12px',
            paddingRight: '28px !important', // Leaves space for the arrow
            paddingTop: '2px',
            paddingBottom: '2px',
            display: 'flex',
            alignItems: 'center',
          },
          '& .MuiSelect-icon': {
            right: '6px',
            color: 'inherit', // Arrow inherits text color
            fontSize: '1.1rem',
          },
        }}
      >
        {TEAM_STATUSES.map((status) => (
          <MenuItem key={status} value={status}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip
                label={status}
                size="small"
                color={STATUS_COLORS[status]}
                sx={{
                  height: 20,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              />
            </Box>
          </MenuItem>
        ))}
      </Select>
    </>
  );
};
