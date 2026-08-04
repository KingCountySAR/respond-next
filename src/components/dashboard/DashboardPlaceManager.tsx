import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { createNewPlace, DEFAULT_PLACES, EquipmentItem, getDefaultPlaces, isDefaultPlace, Place, sortEquipmentAlphabetically } from '@respond/types/operations';

import { useActivityContext } from '../activities/ActivityProvider';
import { Draggable, Droppable } from '../DragAndDrop/DnDComponents';
import { Stack } from '../Material';

import { DashboardBoxWithTitle } from './DashboardBoxWithTitle';
import { DashboardPlaceEditDialog } from './DashboardPlaceEditDialog';
import { DashboardTeamMember } from './DashboardTeamMember';
import { Participant, ParticipantStatus } from '@respond/types/activity';
import { DashboardTeamEquipment } from './DashboardTeamEquipment';

export function DashboardPlaceManager() {
  const dispatch = useAppDispatch();
  const activity = useActivityContext();

  const [addingPlace, setAddingPlace] = useState<Place | null>(null);

  // For backward compatibility, if the activity does not have places
  useEffect(() => {
    const defaultPlaces = getDefaultPlaces(activity);

    if (defaultPlaces.length) {
      dispatch(ActivityActions.updatePlaces(activity.id, [...(activity.places ?? []), ...defaultPlaces]));
    }
  }, [activity, dispatch]);

  const addPlace = (placeToUpsert: Place) => {
    dispatch(ActivityActions.updatePlaces(activity.id, [...(activity.places ?? []), placeToUpsert]));
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

  const participants = (place.assignedParticipants ?? []).flatMap((id) => {
    const participant = activity.participants[id];
    return participant ? [participant] : [];
  });

  const sortedTeamEquipment = [...place.assignedEquipment].sort(sortEquipmentAlphabetically);

  const upsertPlace = (placeToUpsert: Place) => {
    const currentPlaces = activity.places ?? [];
    let exists = false;

    // 1. Map through places: replace if ID matches
    const updatedPlaces = currentPlaces.map((p) => {
      if (p.id === placeToUpsert.id) {
        exists = true;
        return placeToUpsert; // Replace existing place
      }
      return p;
    });

    // 2. Fallback: if it wasn't found in the map, append it
    if (!exists) {
      updatedPlaces.push(placeToUpsert);
    }

    dispatch(ActivityActions.updatePlaces(activity.id, updatedPlaces));
  };

  const deletePlace = (id: string) => {
    dispatch(
      ActivityActions.updatePlaces(
        activity.id,
        activity.places.filter((p) => p.id !== id),
      ),
    );
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
    // Update the Place to include the new participant
    const updated: Place = { ...place, assignedParticipants: [...place.assignedParticipants, participant.id] };
    dispatchUpdate(updated);
  }

  const removeTeamMember = (participantId: string) => {
    const updated: Place = { ...place, assignedParticipants: place.assignedParticipants.filter((id) => id !== participantId) };
    dispatchUpdate(updated);
  }

  const addEquipment = (equipment: EquipmentItem) => {
    const updated: Place = { ...place, assignedEquipment: [...place.assignedEquipment, equipment] };
    dispatchUpdate(updated);
  }

  const removeEquipment = (id: string) => {
    if (place.assignedEquipment.some((item) => item.uuid === id)) {
      // Remove the equipment from the team
      const updated = { ...place, assignedEquipment: place.assignedEquipment.filter((item) => item.uuid !== id) };
      dispatchUpdate(updated);
    }
  }

  const dispatchUpdate = (updated: Place) => {
    dispatch(
      ActivityActions.updatePlaces(
        activity.id,
        activity.places.map((p) => p.id === place.id ? updated : p),
      ),
    );
  }

  return (
    <Droppable accepts={['participant', 'equipment']} onDrop={handleDrop}>
      <DashboardBoxWithTitle title={place.name} actions={actions} collapsible>
        <Stack spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
              Personnel
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 0.5 }}>
              {place.assignedParticipants.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                  None
                </Typography>
              ) : (
                participants.map((participant) => {
                  return (
                    <Draggable type="participant" item={participant} callback={() => removeTeamMember(participant.id)}>
                      <DashboardTeamMember key={participant.id} participant={participant} />
                    </Draggable>
                  );
                })
              )}
            </Stack>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
              Equipment
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 0.5 }}>
              {sortedTeamEquipment.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                  None
                </Typography>
              ) : (
                sortedTeamEquipment.map((item) => {
                  return (
                    <Draggable type="equipment" item={item} callback={() => {
                      if (item.uuid) removeEquipment(item.uuid)
                    }}>
                      <DashboardTeamEquipment key={item.uuid} item={item} />
                    </Draggable>
                  );
                })
              )}
            </Stack>
          </Box>
          {place.lat?.trim() && place.lon?.trim() && (
            <Box sx={{ width: '100%', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Coordinates
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {`${place.lat?.trim()}, ${place.lon?.trim()}`}
              </Typography>
            </Box>
          )}
          {place.notes?.trim() && (
            <Box sx={{ width: '100%', mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
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
    </Droppable>
  );
}
