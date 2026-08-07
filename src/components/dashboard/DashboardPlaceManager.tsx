import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { Participant } from '@respond/types/activity';
import { CommunicationsLogEntry, createNewCommsEntry, createNewPlace, DEFAULT_PLACES, EquipmentItem, getDefaultPlaces, isDefaultPlace, Place, sortEquipmentAlphabetically } from '@respond/types/operations';

import { useActivityContext } from '../activities/ActivityProvider';
import ConfirmDialog from '../ConfirmDialog';
import { Draggable, Droppable } from '../DragAndDrop/DnDComponents';
import { Stack } from '../Material';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';
import { DashboardCopyChip } from './DashboardCopyChip';
import { DashboardPlaceEditDialog } from './DashboardPlaceEditDialog';
import { DashboardTeamEquipment } from './DashboardTeamEquipment';
import { DashboardTeamMember } from './DashboardTeamMember';

export function DashboardPlaceManager() {
  const dispatch = useAppDispatch();
  const activity = useActivityContext();

  const [addingPlace, setAddingPlace] = useState<Place | null>(null);

  // For backward compatibility, if the activity does not have places
  useEffect(() => {
    const defaultPlaces = getDefaultPlaces(activity);

    if (defaultPlaces.length) {
      defaultPlaces.forEach((place) => dispatch(ActivityActions.createPlace(activity.id, place)));
    }
  }, [activity, dispatch]);

  const addPlace = (placeToCreate: Place) => {
    dispatch(ActivityActions.createPlace(activity.id, placeToCreate));
    const parts = [placeToCreate.name, 'established: '];
    if (placeToCreate.lat?.trim() && placeToCreate.lon?.trim()) parts.push(`${placeToCreate.lat.trim()}, ${placeToCreate.lon.trim()}`);
    if (placeToCreate.notes?.trim()) parts.push(placeToCreate.notes.trim());
    const comm: CommunicationsLogEntry = createNewCommsEntry({
      from: placeToCreate.name,
      to: 'CP',
      message: parts.join(' '),
      isAutomated: true,
    });
    dispatch(ActivityActions.addComm(activity.id, comm));
  };

  // nullish coalese for backward compatibility on inital render
  const activityPlaces = activity.places?.filter((f) => f.name !== DEFAULT_PLACES.field || f.assignedParticipants.length || f.assignedEquipment.length) ?? [];

  return (
    <>
      <Stack spacing={1} sx={{ overflow: 'auto' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
          <Box />
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setAddingPlace(createNewPlace('New Place'))}>
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
          addPlace(placeFromForm);
          setAddingPlace(null);
        }}
        onClose={() => setAddingPlace(null)}
      />
    </>
  );
}

function PlaceTile({ place }: { place: Place }) {
  const dispatch = useAppDispatch();
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
      dispatch(ActivityActions.createPlace(activity.id, placeToUpsert));
      return;
    }

    dispatch(ActivityActions.updatePlace(activity.id, placeToUpsert));
  };

  const deletePlace = (id: string) => {
    const hasResources = place.assignedParticipants.length > 0 || place.assignedEquipment.length > 0;
    if (hasResources) {
      setConfirmDeleteOpen(true);
      return;
    }
    dispatch(ActivityActions.deletePlace(activity.id, id));
    logDeleteComm();
  };

  const logDeleteComm = () => {
    const comm: CommunicationsLogEntry = createNewCommsEntry({
      from: place.name,
      to: 'CP',
      message: `${place.name} terminated`,
      isAutomated: true,
    });
    dispatch(ActivityActions.addComm(activity.id, comm));
  };

  const deleteAndReassign = () => {
    const fieldPlace = activity.places?.find((p) => p.name === DEFAULT_PLACES.field);
    const mergedParticipants = Array.from(new Set([...(fieldPlace?.assignedParticipants ?? []), ...place.assignedParticipants]));
    const existingEquipmentIds = new Set(fieldPlace?.assignedEquipment.map((item) => item.uuid));
    const mergedEquipment = [...(fieldPlace?.assignedEquipment ?? []), ...place.assignedEquipment.filter((item) => !existingEquipmentIds.has(item.uuid))];
    const updatedFieldPlace = fieldPlace ? { ...fieldPlace, assignedParticipants: mergedParticipants, assignedEquipment: mergedEquipment } : { ...createNewPlace(DEFAULT_PLACES.field), assignedParticipants: mergedParticipants, assignedEquipment: mergedEquipment };
    dispatch(ActivityActions.batchUpdatePlaces(activity.id, [updatedFieldPlace], [place.id]));
    logDeleteComm();
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
  const handleDrop = (item: any, type: string, callback?: () => void) => {
    if (type === 'participant') {
      // If the item was dragged and dropped back to the same place, cancel.
      if (place.assignedParticipants.includes(item.id)) return;
      addTeamMember(item);
    } else if (type === 'equipment') {
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
    dispatch(ActivityActions.updatePlace(activity.id, updated));
  };

  return (
    <Droppable accepts={['participant', 'equipment']} onDrop={handleDrop}>
      <DashboardBoxWithTitle title={place.name} actions={actions} collapsible>
        <Stack spacing={1}>
          {!!place.assignedParticipants.length && (
            <Stack spacing={0.75} sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                Personnel
              </Typography>
              <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                {!!place.assignedParticipants.length &&
                  participants.map((participant) => {
                    return (
                      <Draggable key={participant.id} type="participant" item={participant} callback={() => removeTeamMember(participant.id)}>
                        <DashboardTeamMember key={participant.id} participant={participant} />
                      </Draggable>
                    );
                  })}
              </Stack>
            </Stack>
          )}
          {!!sortedTeamEquipment.length && (
            <Stack spacing={0.75} sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                Equipment
              </Typography>
              <Stack spacing={0.75} sx={{ mt: 0.5 }}>
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
            </Stack>
          )}
          {place.lat?.trim() && place.lon?.trim() && (
            <Box sx={{ width: '100%', mt: 1, px: 1.75, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Coordinates
              </Typography>
              <DashboardCopyChip value={`${place.lat?.trim()}, ${place.lon?.trim()}`} />
            </Box>
          )}
          {place.notes?.trim() && (
            <Box sx={{ width: '100%', mt: 1, px: 1.75, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Notes
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {place.notes.trim()}
              </Typography>
            </Box>
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
