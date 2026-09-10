import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import MapIcon from '@mui/icons-material/Map';
import { Box, Button, Typography } from '@mui/material';
import { useEffect } from 'react';

import { usePlaceCommands, useResourceCommands } from '@respond/hooks/commands';
import { ParticipantStatus } from '@respond/shared/types/activity';
import { createNewPlace, getDefaultPlaces, isDefaultPlace, Place, sortEquipmentAlphabetically } from '@respond/shared/types/operations';

import { useActivityContext } from '@/client/components/activities/ActivityProvider';
import { useDialogs } from '@/client/components/DialogProvider';
import { Draggable, Droppable } from '@/client/components/DragAndDrop/DnDComponents';
import { Stack } from '@/client/components/Material';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';
import { DashboardCopyChip } from './DashboardCopyChip';
import { DashboardDividedSection } from './DashboardDividedSection';
import { DashboardErrorIndicator } from './DashboardErrorIndicator';
import { DashboardPlaceEditDialog } from './DashboardPlaceEditDialog';
import { DashboardResourceReassignmentDialog } from './DashboardResourceReassignmentDialog';
import { DashboardTeamEquipment } from './DashboardTeamEquipment';
import { DashboardTeamMember } from './DashboardTeamMember';
import { DashboardWeatherDividedSection } from './DashboardWeather';

export function DashboardAddPlaceButton() {
  const activity = useActivityContext();
  const places = usePlaceCommands(activity.id);
  const { open } = useDialogs();

  const handleAdd = async () => {
    const result = await open(DashboardPlaceEditDialog, { activity, place: createNewPlace('') });
    if (result != null) places.createPlace(result);
  };

  return (
    <>
      <Button size="small" variant="contained" onClick={handleAdd}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <AddIcon fontSize="small" />
          <MapIcon fontSize="small" />
        </Box>
      </Button>
    </>
  );
}

export function DashboardPlaceManager() {
  const activity = useActivityContext();
  const places = usePlaceCommands(activity.id);

  // For backward compatibility, if the activity does not have places
  useEffect(() => {
    const defaultPlaces = getDefaultPlaces(activity);

    if (defaultPlaces.length) {
      defaultPlaces.forEach((place) => places.createPlace(place));
    }
  }, [activity, places]);

  // nullish coalese for backward compatibility on inital render
  const activityPlaces = activity.places ?? [];

  return (
    <Stack spacing={1}>
      {activityPlaces.map((place) => (
        <PlaceTile key={place.id} place={place}></PlaceTile>
      ))}
    </Stack>
  );
}

function PlaceTile({ place }: { place: Place }) {
  const activity = useActivityContext();
  const places = usePlaceCommands(activity.id);
  const resources = useResourceCommands(activity.id);
  const { open, confirm } = useDialogs();

  const participants = (place.assignedParticipants ?? []).flatMap((id) => {
    const participant = activity.participants[id];
    return participant ? [participant] : [];
  });

  const sortedTeamEquipment = [...place.assignedEquipment].sort(sortEquipmentAlphabetically);

  const upsertPlace = (placeToUpsert: Place) => {
    const currentPlaces = activity.places ?? [];
    const exists = currentPlaces.some((p) => p.id === placeToUpsert.id);

    if (!exists) {
      places.createPlace(placeToUpsert);
      return;
    }

    places.updatePlace(placeToUpsert);
  };

  const editPlace = async () => {
    const result = await open(DashboardPlaceEditDialog, { activity, place });
    if (result != null) upsertPlace(result);
  };

  const deletePlace = async () => {
    const hasResources = place.assignedParticipants.length + place.assignedEquipment.length > 0;
    if (!hasResources) {
      // Nothing to reassign, so a lightweight confirm is enough
      const confirmed = await confirm({ prompt: `Delete ${place.name}?`, destructive: true, label: 'Delete' });
      if (!confirmed) return;
      places.deletePlace(place.id);
      return;
    }

    const result = await open(DashboardResourceReassignmentDialog, { activity, origin: place, title: `Delete ${place.name}`, action: 'Delete' });
    if (!result) return;
    places.deletePlace(place.id, result.target);
  };

  const editAction = {
    id: 'edit',
    icon: <EditIcon sx={{ fontSize: 16 }} />,
    onClick: () => editPlace(),
  };

  const deleteAction = {
    id: 'delete',
    icon: <DeleteOutlineIcon sx={{ fontSize: 16, color: 'darkred' }} />,
    onClick: () => deletePlace(),
  };

  const actions = isDefaultPlace(place) ? [editAction] : [editAction, deleteAction];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDrop = (item: any, type: string) => {
    if (type === 'participant') {
      // If the item was dragged and dropped back to the same place, cancel.
      if (place.assignedParticipants.includes(item.id)) return;
      resources.assignParticipant(item.id, { type: 'place', id: place.id });
    } else if (type === 'equipment') {
      // Custom items arrive already hydrated (named) via the Draggable's transform.
      // If the item was dragged and dropped back to the same place, cancel.
      if (place.assignedEquipment.find((equipment) => item.uuid === equipment.uuid)) return;
      resources.assignEquipment(item, { type: 'place', id: place.id });
    } else {
      return;
    }
  };

  const hasContent = place.assignedParticipants.length > 0 || place.assignedEquipment.length > 0 || (place.lat?.trim() && place.lon?.trim()) || (place.notes?.trim() && place.notes.trim().length > 0);

  const hasPersonnelError = place.assignedParticipants.some((id) => activity.participants[id].timeline[0].status !== ParticipantStatus.Assigned);

  return (
    <Droppable accepts={['participant', 'equipment']} onDrop={handleDrop}>
      <DashboardBoxWithTitle
        title={place.name}
        actions={actions}
        collapsible={!!hasContent}
        icon={<MapIcon fontSize="small" />}
        adornment={hasPersonnelError ? <DashboardErrorIndicator message="One or more personnel are not assigned to the activity." size={16} /> : undefined}
      >
        {hasContent && (
          <Stack spacing={1}>
            {!!place.assignedParticipants.length && (
              <DashboardDividedSection title="Personnel">
                <Stack spacing={0.5}>
                  {participants.map((participant) => {
                    return (
                      <Draggable key={participant.id} type="participant" item={participant}>
                        <DashboardTeamMember key={participant.id} participant={participant} />
                      </Draggable>
                    );
                  })}
                </Stack>
              </DashboardDividedSection>
            )}
            {!!sortedTeamEquipment.length && (
              <DashboardDividedSection title="Equipment">
                <Stack spacing={0.5}>
                  {sortedTeamEquipment.map((item) => {
                    return (
                      <Draggable key={item.uuid} type="equipment" item={item}>
                        <DashboardTeamEquipment key={item.uuid} item={item} />
                      </Draggable>
                    );
                  })}
                </Stack>
              </DashboardDividedSection>
            )}
            {place.lat?.trim() && place.lon?.trim() && (
              <>
                <DashboardDividedSection title="Coordinates">
                  <DashboardCopyChip value={`${place.lat?.trim()}, ${place.lon?.trim()}`} />
                </DashboardDividedSection>
                <DashboardWeatherDividedSection lat={activity.location.lat} lon={activity.location.lon} />
              </>
            )}
            {place.notes?.trim() && (
              <DashboardDividedSection title="Notes">
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {place.notes.trim()}
                </Typography>
              </DashboardDividedSection>
            )}
          </Stack>
        )}
      </DashboardBoxWithTitle>
    </Droppable>
  );
}
