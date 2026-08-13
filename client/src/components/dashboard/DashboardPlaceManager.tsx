import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, Typography } from '@mui/material';
import React, { useState } from 'react';

import { usePlaceCommands } from '@respond/lib/client/services/places';
import { Participant, ParticipantStatus } from '@respond/shared/types/activity';
import { createNewPlace, DEFAULT_PLACES, EquipmentItem, isDefaultPlace, Place, sortEquipmentAlphabetically } from '@respond/shared/types/operations';

import { useActivityContext } from '../activities/ActivityProvider';
import ConfirmDialog from '../ConfirmDialog';
import { Draggable, Droppable } from '../DragAndDrop/DnDComponents';
import { Stack } from '../Material';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';
import { DashboardCopyChip } from './DashboardCopyChip';
import { DashboardDividedSection } from './DashboardDividedSection';
import { DashboardErrorIndicator } from './DashboardErrorIndicator';
import { DashboardPlaceEditDialog } from './DashboardPlaceEditDialog';
import { DashboardTeamEquipment } from './DashboardTeamEquipment';
import { DashboardTeamMember } from './DashboardTeamMember';

export function DashboardPlaceManager() {
  const places = usePlaceCommands();
  const activity = useActivityContext();

  const [addingPlace, setAddingPlace] = useState<Place | null>(null);

  // nullish coalese for backward compatibility on inital render
  const activityPlaces = activity.places ?? [];

  return (
    <>
      <Stack spacing={2} sx={{ overflow: 'auto' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box />
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddingPlace(createNewPlace(''))}>
            Add
          </Button>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {activityPlaces.map((place) => (
            <PlaceTile key={place.id} place={place}></PlaceTile>
          ))}
        </Box>
      </Stack>
      <DashboardPlaceEditDialog
        place={addingPlace}
        onSave={(placeFromForm) => {
          places.createPlace(activity.id, placeFromForm);
          setAddingPlace(null);
        }}
        onClose={() => setAddingPlace(null)}
      />
    </>
  );
}

function PlaceTile({ place }: { place: Place }) {
  const places = usePlaceCommands();
  const activity = useActivityContext();

  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const participants = (place.assignedParticipants ?? []).flatMap((id) => {
    const participant = activity.participants[id];
    return participant ? [participant] : [];
  });

  const sortedTeamEquipment = [...place.assignedEquipment].sort(sortEquipmentAlphabetically);

  const upsertPlace = (placeToUpsert: Place) => {
    const currentPlaces = activity.places ?? [];
    const exists = currentPlaces.some((p) => p.id === placeToUpsert.id);

    if (!exists) {
      places.createPlace(activity.id, placeToUpsert);
      return;
    }

    places.updatePlace(activity.id, placeToUpsert);
  };

  // The place-comms reactor logs the "terminated" comm server-side on delete.
  const deletePlace = (id: string) => {
    const hasResources = place.assignedParticipants.length > 0 || place.assignedEquipment.length > 0;
    if (hasResources) {
      setConfirmDeleteOpen(true);
      return;
    }
    places.deletePlace(activity.id, id);
  };

  const deleteAndReassign = () => {
    const fieldPlace = activity.places?.find((p) => p.name === DEFAULT_PLACES.field);
    const mergedParticipants = Array.from(new Set([...(fieldPlace?.assignedParticipants ?? []), ...place.assignedParticipants]));
    const existingEquipmentIds = new Set(fieldPlace?.assignedEquipment.map((item) => item.uuid));
    const mergedEquipment = [...(fieldPlace?.assignedEquipment ?? []), ...place.assignedEquipment.filter((item) => !existingEquipmentIds.has(item.uuid))];
    const updatedFieldPlace = fieldPlace
      ? { ...fieldPlace, assignedParticipants: mergedParticipants, assignedEquipment: mergedEquipment }
      : { ...createNewPlace(DEFAULT_PLACES.field), assignedParticipants: mergedParticipants, assignedEquipment: mergedEquipment };
    places.batchUpdatePlaces(activity.id, [updatedFieldPlace], [place.id]);
  };

  const editAction = {
    id: 'edit',
    icon: <EditIcon sx={{ fontSize: 16 }} />,
    onClick: () => setEditingPlace(place),
  };

  const deleteAction = {
    id: 'delete',
    icon: <DeleteOutlineIcon sx={{ fontSize: 16, color: 'darkred' }} />,
    onClick: () => deletePlace(place.id),
  };

  const actions = isDefaultPlace(place) ? [editAction] : [editAction, deleteAction];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDrop = (item: any, type: string, callback?: (...args: any[]) => void) => {
    if (type === 'participant') {
      // If the item was dragged and dropped back to the same place, cancel.
      if (place.assignedParticipants.includes(item.id)) return;
      addTeamMember(item);
    } else if (type === 'equipment') {
      if (!!callback && item.type === 'Custom' && item.name === 'Custom Item') {
        callback({ item, onSave: (newItem: EquipmentItem) => addEquipment(newItem) });
        return;
      }
      // If the item was dragged and dropped back to the same place, cancel.
      if (place.assignedEquipment.find((equipment) => item.uuid === equipment.uuid)) return;
      addEquipment(item);
    } else {
      return;
    }
    callback?.();
  };

  const addTeamMember = (participant: Participant) => {
    dispatchUpdate({ ...place, assignedParticipants: [...place.assignedParticipants, participant.id] });
  };

  const removeTeamMember = (participantId: string) => {
    if (place.assignedParticipants.includes(participantId)) {
      dispatchUpdate({ ...place, assignedParticipants: place.assignedParticipants.filter((id) => id !== participantId) });
    }
  };

  const addEquipment = (equipment: EquipmentItem) => {
    dispatchUpdate({ ...place, assignedEquipment: [...place.assignedEquipment, equipment] });
  };

  const removeEquipment = (id: string) => {
    if (place.assignedEquipment.some((item) => item.uuid === id)) {
      dispatchUpdate({ ...place, assignedEquipment: place.assignedEquipment.filter((item) => item.uuid !== id) });
    }
  };

  const dispatchUpdate = (updated: Place) => {
    places.updatePlace(activity.id, updated);
  };

  const hasContent = place.assignedParticipants.length > 0 || place.assignedEquipment.length > 0 || (place.lat?.trim() && place.lon?.trim()) || (place.notes?.trim() && place.notes.trim().length > 0);

  const hasPersonnelError = place.assignedParticipants.some((id) => activity.participants[id].timeline[0].status !== ParticipantStatus.Assigned);

  return (
    <Droppable accepts={['participant', 'equipment']} onDrop={handleDrop}>
      <DashboardBoxWithTitle
        title={place.name}
        actions={actions}
        collapsible={!!hasContent}
        adornment={hasPersonnelError ? <DashboardErrorIndicator message="One or more personnel are not assigned to the activity." size={16} /> : undefined}
      >
        <Stack spacing={1}>
          {!!place.assignedParticipants.length && (
            <DashboardDividedSection title="Personnel">
              <Stack spacing={0.5}>
                {participants.map((participant) => {
                  return (
                    <Draggable key={participant.id} type="participant" item={participant} callback={() => removeTeamMember(participant.id)}>
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
                })}
              </Stack>
            </DashboardDividedSection>
          )}
          {place.lat?.trim() && place.lon?.trim() && (
            <DashboardDividedSection title="Coordinates">
              <DashboardCopyChip value={`${place.lat?.trim()}, ${place.lon?.trim()}`} />
            </DashboardDividedSection>
          )}
          {place.notes?.trim() && (
            <DashboardDividedSection title="Notes">
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {place.notes.trim()}
              </Typography>
            </DashboardDividedSection>
          )}
        </Stack>
      </DashboardBoxWithTitle>
      <DashboardPlaceEditDialog
        place={editingPlace}
        onSave={(placeFromForm) => {
          upsertPlace(placeFromForm);
          setEditingPlace(null);
        }}
        onClose={() => setEditingPlace(null)}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        prompt={`"${place.name}" still has assigned members or equipment. They will be moved to ${DEFAULT_PLACES.field}. Delete anyway?`}
        onConfirm={() => {
          deleteAndReassign();
          setConfirmDeleteOpen(false);
        }}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </Droppable>
  );
}
