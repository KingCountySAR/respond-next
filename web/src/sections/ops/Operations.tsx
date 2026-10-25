/** The right-hand column: the description, groups, places and the equipment summary. */
import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import GroupsIcon from '@mui/icons-material/Groups';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import MapIcon from '@mui/icons-material/Map';
import { Autocomplete, Box, Button, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import Linkify from 'linkify-react';
import { useState, type FormEvent } from 'react';
import { DEFAULT_PLACES } from '@sync/domain';
import type { ManageActivity, ManageGroup, ManageParticipant, ManagePlace } from '@sync/model';
import { observer, useManageActivity } from '@sync/model/react';
import { useDialogs, type MuiDialogProps } from '../../shell/dialogs';
import { AppDialog } from '../../shell/dialogs/AppDialog';
import { useChange } from '../../ui/useChange';
import { useAssignResponder } from './NewLeaderDialog';
import { Draggable, Droppable } from './dnd';
import { dropEquipment, type EquipmentDrag } from './drops';
import { byName, compareTeamNames, equipmentSummary } from './opsRules';
import { DashboardBoxWithTitle, DashboardCopyChip, DashboardDividedSection, DashboardErrorIndicator, type BoxAction } from './parts';
import { DashboardTeamEquipment, DashboardTeamMember, hasUnassignedPersonnel } from './People';
import { chooseReassignment } from './ReassignDialog';
import { DashboardWeatherDividedSection } from './Weather';

const editIcon = <EditIcon sx={{ fontSize: 16 }} />;
const deleteIcon = <DeleteOutlineIcon sx={{ fontSize: 16, color: 'darkred' }} />;

// --- Description ----------------------------------------------------------------------------

export const DashboardActivityDescription = observer(function DashboardActivityDescription() {
  const activity = useManageActivity();
  const { open } = useDialogs();
  const description = activity.record?.description ?? '';
  return (
    <DashboardBoxWithTitle title="Description" actions={[{ id: 'edit', label: 'Edit description', icon: editIcon, onClick: () => void open(DescriptionEditDialog, { activity }) }]} collapsible={description.trim() !== ''}>
      {description && (
        <Typography variant="body2" color="text.secondary">
          <Linkify>{description}</Linkify>
        </Typography>
      )}
    </DashboardBoxWithTitle>
  );
});

function DescriptionEditDialog({ activity, onClose }: MuiDialogProps<null> & { activity: ManageActivity }) {
  const change = useChange();
  const [description, setDescription] = useState(activity.record?.description ?? '');
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (change(() => activity.update({ description: description.trim() }))) onClose(null);
  };
  return (
    <AppDialog fullWidth open onClose={onClose}>
      <DialogTitle>Edit Description</DialogTitle>
      <form onSubmit={save}>
        <DialogContent>
          <TextField autoFocus label="Description" fullWidth multiline minRows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(null)}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </form>
    </AppDialog>
  );
}

// --- Groups ---------------------------------------------------------------------------------

const GROUP_NAME_OPTIONS = ['Rescue Group', 'Medical Group', 'Rigging Group', '4X4 Group'];

/** A "+ groups" button: names a new group. */
export function DashboardAddGroupButton() {
  const activity = useManageActivity();
  const change = useChange();
  const { open } = useDialogs();
  const add = async () => {
    const name = await open(GroupEditDialog, { activity, group: null });
    if (name != null) change(() => activity.createGroup(name));
  };
  return (
    <Button size="small" variant="contained" aria-label="Add group" onClick={add}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <AddIcon fontSize="small" />
        <GroupsIcon fontSize="small" />
      </Box>
    </Button>
  );
}

export const DashboardGroupManager = observer(function DashboardGroupManager() {
  const groups = useManageActivity().groups;
  return (
    <Stack spacing={1}>
      {groups.map((group) => (
        <GroupTile key={group.id} group={group} />
      ))}
    </Stack>
  );
});

const GroupTile = observer(function GroupTile({ group }: { group: ManageGroup }) {
  const activity = useManageActivity();
  const dialogs = useDialogs();
  const change = useChange();
  const members = group.members;
  const assign = useAssignResponder();
  const equipment = [...group.equipment].sort(byName);
  const teams = [...group.teams].sort((a, b) => compareTeamNames(a.name, b.name));
  const leader = group.leader;

  const editGroup = async () => {
    const name = await dialogs.open(GroupEditDialog, { activity, group });
    if (name != null) change(() => group.rename(name));
  };

  const deleteGroup = async () => {
    const target = await chooseReassignment(dialogs, activity, group.asTarget, {
      holdsResources: members.length + equipment.length > 0,
      title: `Delete ${group.name}`,
      action: 'Delete',
      confirmPrompt: `Delete ${group.name}?`,
    });
    if (target !== undefined) change(() => group.delete(target));
  };

  const actions: BoxAction[] = [
    { id: 'edit', label: `Edit ${group.name}`, icon: editIcon, onClick: () => void editGroup() },
    { id: 'delete', label: `Delete ${group.name}`, icon: deleteIcon, onClick: () => void deleteGroup() },
  ];

  // A person dropped on the title leads the group, wherever they are; in the body, joins it.
  const handleHeaderDrop = (item: ManageParticipant | EquipmentDrag, type: string) => {
    if (type === 'participant') {
      const p = item as ManageParticipant;
      if (leader?.id !== p.id) change(() => group.setLeader(p));
    } else if (type === 'equipment') {
      change(() => dropEquipment(activity, item as EquipmentDrag, group.asTarget));
    }
  };

  const handleBodyDrop = (item: ManageParticipant | EquipmentDrag, type: string) => {
    if (type === 'participant') {
      const p = item as ManageParticipant;
      if (!members.some((m) => m.id === p.id)) assign(p, group.asTarget);
    } else if (type === 'equipment') {
      change(() => dropEquipment(activity, item as EquipmentDrag, group.asTarget));
    }
  };

  const hasContent = members.length > 0 || equipment.length > 0 || teams.length > 0;

  const subtitle = (
    <Stack direction="row" sx={{ '&:hover .action': { opacity: 1, visibility: 'visible' }, alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography component="div" sx={{ color: 'text.secondary' }}>
        {leader ? leader.name : 'Unassigned'}
      </Typography>
      {leader && (
        <IconButton className="action" onClick={() => change(() => group.setLeader(null))} size="small" aria-label={`Clear the leader of ${group.name}`} sx={{ opacity: 0, visibility: 'hidden', transition: 'opacity 180ms ease' }}>
          <ClearIcon sx={{ fontSize: 14, color: 'darkred' }} />
        </IconButton>
      )}
    </Stack>
  );

  return (
    <Droppable accepts={['participant', 'equipment']} onDrop={handleHeaderDrop}>
      <DashboardBoxWithTitle
        title={group.name}
        subtitle={subtitle}
        actions={actions}
        collapse
        collapsible
        icon={<GroupsIcon fontSize="small" />}
        adornment={hasUnassignedPersonnel(members) ? <DashboardErrorIndicator message="One or more personnel are not assigned to the activity." size={16} /> : undefined}
      >
        <Droppable accepts={['participant', 'equipment']} onDrop={handleBodyDrop}>
          <Stack spacing={1}>
            {!!members.length && (
              <DashboardDividedSection title="Personnel">
                <Stack spacing={0.5}>
                  {members.map((p) => (
                    <Draggable key={p.id} type="participant" item={p}>
                      <DashboardTeamMember participant={p} />
                    </Draggable>
                  ))}
                </Stack>
              </DashboardDividedSection>
            )}
            {!!equipment.length && (
              <DashboardDividedSection title="Equipment">
                <Stack spacing={0.5}>
                  {equipment.map((item) => (
                    <Draggable key={item.id} type="equipment" item={{ item } satisfies EquipmentDrag}>
                      <DashboardTeamEquipment item={item} />
                    </Draggable>
                  ))}
                </Stack>
              </DashboardDividedSection>
            )}
            {!!teams.length && (
              <DashboardDividedSection title="Teams">
                <Stack spacing={0.5}>
                  {teams.map((team) => (
                    <Box key={team.id}>{team.name}</Box>
                  ))}
                </Stack>
              </DashboardDividedSection>
            )}
          </Stack>
          {!hasContent && (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 1 }}>
              No resources assigned.
            </Typography>
          )}
        </Droppable>
      </DashboardBoxWithTitle>
    </Droppable>
  );
});

/** Names a group (new when `group` is null), suggesting the usual names not taken yet. Closes with the name. */
function GroupEditDialog({ activity, group, onClose }: MuiDialogProps<string> & { activity: ManageActivity; group: ManageGroup | null }) {
  const [name, setName] = useState(group?.name ?? '');
  const [error, setError] = useState<string>();
  const others = activity.groups.filter((g) => g.id !== group?.id).map((g) => g.name);
  const taken = new Set(activity.groups.map((g) => g.name.trim().toLowerCase()));
  const options = GROUP_NAME_OPTIONS.filter((option) => !taken.has(option.toLowerCase()));

  const save = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) setError('Name is required');
    else if (others.some((o) => o.trim().toLowerCase() === trimmed.toLowerCase())) setError('Group name already exists');
    else onClose(trimmed);
  };

  return (
    <AppDialog open onClose={onClose} fullWidth>
      <DialogTitle>Edit Group</DialogTitle>
      <form onSubmit={save}>
        <DialogContent>
          <Stack spacing={1}>
            <Autocomplete
              freeSolo
              fullWidth
              options={options}
              inputValue={name}
              onInputChange={(_, value) => setName(value)}
              renderInput={(params) => <TextField {...params} autoFocus label="Group Name" error={!!error} helperText={error ?? 'Choose a unique name for this group.'} />}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(null)}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </form>
    </AppDialog>
  );
}

// --- Places ---------------------------------------------------------------------------------

const DEFAULT_PLACE_NAMES: string[] = Object.values(DEFAULT_PLACES);
const isDefaultPlace = (place: { name: string }) => DEFAULT_PLACE_NAMES.includes(place.name);

/** The default places (Command Post, Field) first, then the rest by name. */
const placeOrder = (a: ManagePlace, b: ManagePlace) => {
  const [ia, ib] = [DEFAULT_PLACE_NAMES.indexOf(a.name), DEFAULT_PLACE_NAMES.indexOf(b.name)];
  if (ia !== ib) return ia === -1 ? 1 : ib === -1 ? -1 : ia - ib;
  return a.name.localeCompare(b.name);
};

export function DashboardAddPlaceButton() {
  const activity = useManageActivity();
  const change = useChange();
  const { open } = useDialogs();
  const add = async () => {
    const fields = await open(PlaceEditDialog, { activity, place: null });
    if (fields != null) change(() => activity.createPlace(fields));
  };
  return (
    <Button size="small" variant="contained" aria-label="Add place" onClick={add}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <AddIcon fontSize="small" />
        <MapIcon fontSize="small" />
      </Box>
    </Button>
  );
}

export const DashboardPlaceManager = observer(function DashboardPlaceManager() {
  const places = [...useManageActivity().places].sort(placeOrder);
  return (
    <Stack spacing={1}>
      {places.map((place) => (
        <PlaceTile key={place.id} place={place} />
      ))}
    </Stack>
  );
});

const PlaceTile = observer(function PlaceTile({ place }: { place: ManagePlace }) {
  const activity = useManageActivity();
  const dialogs = useDialogs();
  const change = useChange();
  const members = place.members;
  const assign = useAssignResponder();
  const equipment = [...place.equipment].sort(byName);
  const notes = place.notes?.trim();
  const hasPoint = place.lat != null && place.lon != null;

  const editPlace = async () => {
    const fields = await dialogs.open(PlaceEditDialog, { activity, place });
    if (fields != null) change(() => place.update(fields));
  };

  const deletePlace = async () => {
    const target = await chooseReassignment(dialogs, activity, place.asTarget, {
      holdsResources: members.length + equipment.length > 0,
      title: `Delete ${place.name}`,
      action: 'Delete',
      confirmPrompt: `Delete ${place.name}?`,
    });
    if (target !== undefined) change(() => place.delete(target));
  };

  const editAction: BoxAction = { id: 'edit', label: `Edit ${place.name}`, icon: editIcon, onClick: () => void editPlace() };
  const actions = isDefaultPlace(place) ? [editAction] : [editAction, { id: 'delete', label: `Delete ${place.name}`, icon: deleteIcon, onClick: () => void deletePlace() }];

  const handleDrop = (item: ManageParticipant | EquipmentDrag, type: string) => {
    if (type === 'participant') {
      const p = item as ManageParticipant;
      if (!members.some((m) => m.id === p.id)) assign(p, place.asTarget);
    } else if (type === 'equipment') {
      change(() => dropEquipment(activity, item as EquipmentDrag, place.asTarget));
    }
  };

  const hasContent = members.length > 0 || equipment.length > 0 || hasPoint || !!notes;

  return (
    <Droppable accepts={['participant', 'equipment']} onDrop={handleDrop}>
      <DashboardBoxWithTitle
        title={place.name}
        actions={actions}
        collapsible={hasContent}
        icon={<MapIcon fontSize="small" />}
        adornment={hasUnassignedPersonnel(members) ? <DashboardErrorIndicator message="One or more personnel are not assigned to the activity." size={16} /> : undefined}
      >
        {hasContent && (
          <Stack spacing={1}>
            {!!members.length && (
              <DashboardDividedSection title="Personnel">
                <Stack spacing={0.5}>
                  {members.map((p) => (
                    <Draggable key={p.id} type="participant" item={p}>
                      <DashboardTeamMember participant={p} />
                    </Draggable>
                  ))}
                </Stack>
              </DashboardDividedSection>
            )}
            {!!equipment.length && (
              <DashboardDividedSection title="Equipment">
                <Stack spacing={0.5}>
                  {equipment.map((item) => (
                    <Draggable key={item.id} type="equipment" item={{ item } satisfies EquipmentDrag}>
                      <DashboardTeamEquipment item={item} />
                    </Draggable>
                  ))}
                </Stack>
              </DashboardDividedSection>
            )}
            {hasPoint && (
              <>
                <DashboardDividedSection title="Coordinates">
                  <DashboardCopyChip value={`${place.lat}, ${place.lon}`} />
                </DashboardDividedSection>
                <DashboardWeatherDividedSection lat={place.lat!} lon={place.lon!} />
              </>
            )}
            {notes && (
              <DashboardDividedSection title="Notes">
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {notes}
                </Typography>
              </DashboardDividedSection>
            )}
          </Stack>
        )}
      </DashboardBoxWithTitle>
    </Droppable>
  );
});

type PlaceFields = { name: string; lat: number | null; lon: number | null; notes: string | null };
type PlaceErrors = Partial<Record<'name' | 'lat' | 'lon', string>>;

/** The legacy place form's rules; coordinates are optional but come as a pair. */
export function validatePlace(values: { name: string; lat: string; lon: string }, otherNames: string[]): PlaceErrors {
  const errors: PlaceErrors = {};
  const [name, lat, lon] = [values.name.trim(), values.lat.trim(), values.lon.trim()];
  if (!name) errors.name = 'Name is required';
  if (otherNames.some((n) => n.trim().toLowerCase() === name.toLowerCase())) errors.name = 'Place name already exists';
  if (lat && !lon) errors.lon = 'Longitude is required when latitude is provided';
  if (lon && !lat) errors.lat = 'Latitude is required when longitude is provided';
  if (lat) {
    const n = Number(lat);
    if (!Number.isFinite(n)) errors.lat = 'Latitude must be a valid decimal number';
    else if (n < -90 || n > 90) errors.lat = 'Latitude must be between -90 and 90';
  }
  if (lon) {
    const n = Number(lon);
    if (!Number.isFinite(n)) errors.lon = 'Longitude must be a valid decimal number';
    else if (n < -180 || n > 180) errors.lon = 'Longitude must be between -180 and 180';
  }
  return errors;
}

/** Edits a place (new when null). A default place keeps its name and has no coordinates. Closes with the fields. */
function PlaceEditDialog({ activity, place, onClose }: MuiDialogProps<PlaceFields> & { activity: ManageActivity; place: ManagePlace | null }) {
  const isDefault = !!place && isDefaultPlace(place);
  const [values, setValues] = useState({ name: place?.name ?? '', lat: place?.lat?.toString() ?? '', lon: place?.lon?.toString() ?? '', notes: place?.notes ?? '' });
  const [errors, setErrors] = useState<PlaceErrors>({});

  const save = (e: FormEvent) => {
    e.preventDefault();
    const found = validatePlace(
      values,
      activity.places.filter((p) => p.id !== place?.id).map((p) => p.name),
    );
    setErrors(found);
    if (Object.keys(found).length) return;
    const [lat, lon] = [values.lat.trim(), values.lon.trim()];
    onClose({ name: values.name.trim(), lat: lat ? Number(lat) : null, lon: lon ? Number(lon) : null, notes: values.notes.trim() || null });
  };

  const field = (name: keyof typeof values) => ({ value: values[name], onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value })) });

  return (
    <AppDialog fullWidth open onClose={onClose}>
      <DialogTitle>Edit Place</DialogTitle>
      <form onSubmit={save}>
        <DialogContent>
          <Stack spacing={1}>
            <TextField autoFocus label="Place Name" disabled={isDefault} fullWidth {...field('name')} error={!!errors.name} helperText={errors.name ?? 'Choose a unique name for this place.'} />
            {!isDefault && <TextField label="Latitude" fullWidth {...field('lat')} error={!!errors.lat} helperText={errors.lat ?? 'Optional, decimal degrees (-90 to 90).'} />}
            {!isDefault && <TextField label="Longitude" fullWidth {...field('lon')} error={!!errors.lon} helperText={errors.lon ?? 'Optional, decimal degrees (-180 to 180).'} />}
            <TextField label="Notes" fullWidth multiline minRows={3} {...field('notes')} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(null)}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save
          </Button>
        </DialogActions>
      </form>
    </AppDialog>
  );
}

// --- Equipment summary ----------------------------------------------------------------------

/** What's on scene, assigned out, and staged at places. */
export const DashboardEquipmentSummary = observer(function DashboardEquipmentSummary() {
  const summary = equipmentSummary(useManageActivity());
  const icon = <Inventory2Icon fontSize="small" />;
  return (
    <Stack spacing={1}>
      <DashboardBoxWithTitle title="On Scene" icon={icon} collapsible={!!summary.onScene.length}>
        {summary.onScene.map(([name, count]) => (
          <Typography key={name} variant="subtitle1" sx={{ whiteSpace: 'pre-line' }}>
            {`${count} - ${name}`}
          </Typography>
        ))}
      </DashboardBoxWithTitle>
      <DashboardBoxWithTitle title="Assigned" icon={icon} collapsible={!!summary.assigned.length}>
        {summary.assigned.map(({ name, count, holders }) => (
          <Box key={name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ whiteSpace: 'pre-line', mr: 1 }}>
              {`${count} - ${name}`}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
              {holders.join(', ')}
            </Typography>
          </Box>
        ))}
      </DashboardBoxWithTitle>
      <DashboardBoxWithTitle title="Staged" icon={icon} collapsible={!!summary.staged.length}>
        {summary.staged.map(({ place, counts }) => (
          <div key={place.id}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 0.5 }}>
              {place.name}
            </Typography>
            {counts.map(([name, count]) => (
              <Typography key={name} variant="subtitle1" sx={{ whiteSpace: 'pre-line' }}>
                {`${count} - ${name}`}
              </Typography>
            ))}
          </div>
        ))}
      </DashboardBoxWithTitle>
    </Stack>
  );
});
