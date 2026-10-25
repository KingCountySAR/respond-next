import { Autocomplete, Box, Button, CircularProgress, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { MEMBER_QUERY_MIN, type MemberInfo, type SiteUnit } from '@sync/domain';
import type { RespondActivity } from '@sync/model';
import { observer } from '@sync/model/react';
import { useApi } from '../../../shell/api';
import { useSite } from '../../../shell/App';
import { useDialogs, type MuiDialogProps } from '../../../shell/dialogs';
import { AppDialog } from '../../../shell/dialogs/AppDialog';
import { ParticipantTimeline } from './ParticipantTimeline';
import { StatusUpdater } from './StatusUpdater';

const SEARCH_DEBOUNCE_MS = 500;

const getTitle = (activity: RespondActivity) => `Add ${activity.record?.kind === 'mission' ? 'Responder' : 'Participant'}`;

export function AddParticipantButton({ activity }: { activity: RespondActivity }) {
  const { open } = useDialogs();
  return (
    <Button size="small" variant="outlined" onClick={() => open(AddParticipantDialog, { activity })}>
      {getTitle(activity)}
    </Button>
  );
}

/** Pick a unit, find one of its members, and set their status: the legacy Add Responder dialog. */
const AddParticipantDialog = observer(function AddParticipantDialog({ open, activity, onClose }: MuiDialogProps & { activity: RespondActivity }) {
  const [unit, setUnit] = useState<SiteUnit | undefined>(undefined);
  const [member, setMember] = useState<MemberInfo | undefined>(undefined);
  const participant = member ? activity.participantByRef(member.personRef) : undefined;

  return (
    <AppDialog fullWidth={true} open={open} onClose={onClose}>
      <DialogTitle sx={{ alignItems: 'center', justifyContent: 'space-between', display: 'flex' }}>
        <Box>{getTitle(activity)}</Box>
      </DialogTitle>
      <DialogContent>
        <Stack sx={{ py: 1 }} spacing={2}>
          <UnitSelect
            onChange={(u) => {
              setUnit(u);
              setMember(undefined);
            }}
          />
          {/* Keyed by unit, so changing unit starts the search over. */}
          <MemberSearch key={unit?.id ?? ''} unitId={unit?.id} onChange={setMember} />
          {participant && <ParticipantTimeline participant={participant} />}
          {unit && member && (
            <StatusUpdater
              activity={activity}
              person={{ personRef: member.personRef, firstname: member.given_name, lastname: member.family_name }}
              unit={{ id: unit.id, title: unit.title, rosterName: unit.shortTitle }}
              fullWidth
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(null)}>Close</Button>
      </DialogActions>
    </AppDialog>
  );
});

/** The legacy OrganizationSelect: the site's unit and its partners. */
function UnitSelect({ onChange }: { onChange: (unit: SiteUnit | undefined) => void }) {
  const org = useSite().organization;
  const units = [org, ...org.partners];
  const [value, setValue] = useState('');
  return (
    <FormControl fullWidth>
      <InputLabel id="add-participant-unit-label">Organization</InputLabel>
      <Select
        labelId="add-participant-unit-label"
        value={value}
        label="Organization"
        onChange={(e) => {
          setValue(e.target.value);
          onChange(units.find((u) => u.id === e.target.value));
        }}
      >
        {units.map((u) => (
          <MenuItem key={u.id} value={u.id}>
            {u.title}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

/** The legacy MemberSearch: the unit's directory, searched once the query has 3 characters. */
function MemberSearch({ unitId, onChange }: { unitId: string | undefined; onChange: (member: MemberInfo | undefined) => void }) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [options, setOptions] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!unitId || debounced.trim().length < MEMBER_QUERY_MIN) return setOptions([]);
    let live = true;
    setLoading(true);
    api
      .searchMembers(unitId, debounced.trim())
      .then((found) => live && setOptions(found))
      .catch(() => live && setOptions([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [api, unitId, debounced]);

  return (
    <Autocomplete
      disabled={!unitId}
      open={open && !!debounced}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onInputChange={(_, value) => setSearch(value)}
      onChange={(_, value) => onChange(value ?? undefined)}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      getOptionLabel={(option) => option.label ?? ''}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          {option.label}
        </li>
      )}
      options={options}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Member"
          variant="outlined"
          helperText="Search by member name or email (min 3 characters)"
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
