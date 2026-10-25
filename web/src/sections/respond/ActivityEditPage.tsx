import AddLocation from '@mui/icons-material/AddLocation';
import Edit from '@mui/icons-material/Edit';
import { Box, Button, FormControl, FormControlLabel, FormGroup, FormHelperText, Grid, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useSearch } from 'wouter';
import { randomId } from '@sync/core';
import { DEFAULT_EARLY_SIGN_IN_WINDOW, fromSaved, canManageMissions } from '@sync/domain';
import type { RespondActivity } from '@sync/model';
import { observer, useRespondActivity } from '@sync/model/react';
import { useSite } from '../../shell/App';
import { useDialogs } from '../../shell/dialogs';
import { useSyncClient } from '../../shell/sync';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { LocationAutocomplete } from '../../ui/locations/LocationAutocomplete';
import { LocationEditDialog } from '../../ui/locations/LocationEditDialog';
import { ActivityDraft, EARLY_SIGN_IN_WINDOWS } from './activityDraft';
import { useChange } from '../../ui/useChange';

export type ActivityType = 'missions' | 'events';

// A Select's values are strings; "Open Immediately" (a null window) is 'open'.
const windowValue = (w: number | null) => (w === null ? 'open' : String(w));
const windowOf = (value: string) => EARLY_SIGN_IN_WINDOWS.find((o) => windowValue(o.window) === value)?.window ?? DEFAULT_EARLY_SIGN_IN_WINDOW;

/** New mission (or event). From the ops home (`?then=ops`), saving opens its ops dashboard. */
export function ActivityNewPage({ activityType }: { activityType: ActivityType }) {
  const toDashboard = new URLSearchParams(useSearch()).get('then') === 'ops';
  return <ActivityEditForm activityType={activityType} toDashboard={toDashboard} />;
}

/** Edit an activity; under ActivityLayout. */
export const ActivityEditPage = observer(function ActivityEditPage({ activityType }: { activityType: ActivityType }) {
  return <ActivityEditForm activityType={activityType} activity={useRespondActivity()} />;
});

const ActivityEditForm = observer(function ActivityEditForm({ activityType, activity, toDashboard }: { activityType: ActivityType; activity?: RespondActivity; toDashboard?: boolean }) {
  const org = useSite().organization;
  const client = useSyncClient();
  const [, navigate] = useLocation();
  const { open } = useDialogs();
  const change = useChange();
  const [draft] = useState(() => new ActivityDraft(org, { missions: activityType === 'missions', activity, now: Date.now() }));
  const { errors, isNew } = draft;

  const focusRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    focusRef.current?.focus();
  }, []);

  const editLocation = async () => {
    const location = await open(LocationEditDialog, { location: draft.location });
    if (location) draft.set('location', location);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const plan = draft.save(Date.now(), randomId);
    if (!plan) return;
    // A new activity is opened on the client first; the activity page then shares it.
    if (plan.isNew) await client.open(plan.activityId);
    const saved = change(() => plan.mutations.forEach((m) => client.mutate(plan.activityId, m.name, m.args)));
    // Optimistic, as the legacy app: a later refusal shows on the activity page.
    if (saved) navigate(toDashboard ? `~/ops/${plan.activityId}` : `~${plan.path}`);
  };

  const selectedType = draft.isMission ? 'missions' : 'events';
  // Members may create and manage other events; missions are for managers.
  const manageMissions = canManageMissions(activity ? client.viewerIn(activity.activityId) : client.viewer);
  const ownerChoices = draft.ownerChoices;
  const startsLater = draft.startsAfter(Date.now());

  return (
    <ToolbarPage>
      <Paper>
        <form onSubmit={submit}>
          <Grid container spacing={2} sx={{ padding: 2, alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth error={!!errors.title}>
                <TextField value={draft.title} onChange={(e) => draft.set('title', e.target.value)} inputRef={focusRef} variant="outlined" label="Name" required />
                <FormHelperText>{errors.title}</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel id="activity-type-label">Type</InputLabel>
                <Select labelId="activity-type-label" label="Type" value={selectedType} onChange={(event) => draft.set('isMission', event.target.value === 'missions')}>
                  <MenuItem value="missions" disabled={!manageMissions}>
                    Mission
                  </MenuItem>
                  <MenuItem value="events">Event</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={12}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <FormControl fullWidth error={!!errors.location}>
                  <LocationAutocomplete value={draft.location} onChange={(l) => draft.set('location', l ? fromSaved(l) : null)} variant="outlined" required />
                  <FormHelperText>{errors.location}</FormHelperText>
                </FormControl>
                <Box sx={{ paddingRight: 2 }}>
                  <IconButton color="default" aria-label={draft.location?.title ? 'Edit location' : 'Add location'} onClick={editLocation}>
                    {draft.location?.title ? <Edit /> : <AddLocation />}
                  </IconButton>
                </Box>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <TextField value={draft.mapId} onChange={(e) => draft.set('mapId', e.target.value)} variant="outlined" label="Map Id" />
                <FormHelperText></FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <TextField value={draft.idNumber} onChange={(e) => draft.set('idNumber', e.target.value)} variant="outlined" label="State Number" />
                <FormHelperText></FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel variant="outlined" id="activity-owner-label">
                  Responsible Agency
                </InputLabel>
                <Select labelId="activity-owner-label" value={ownerChoices.some((o) => o.id === draft.ownerOrgId) ? draft.ownerOrgId : ''} onChange={(e) => draft.set('ownerOrgId', e.target.value)} variant="outlined" label="Responsible Agency">
                  {ownerChoices.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth disabled={!startsLater}>
                <InputLabel variant="outlined" id="activity-window-label">
                  Early Sign In Window
                </InputLabel>
                <Select
                  labelId="activity-window-label"
                  value={windowValue(draft.earlySignInWindow)}
                  onChange={(e) => draft.set('earlySignInWindow', windowOf(e.target.value))}
                  variant="outlined"
                  label="Early Sign In Window"
                >
                  {EARLY_SIGN_IN_WINDOWS.map((p) => (
                    <MenuItem key={p.label} value={windowValue(p.window)}>
                      {p.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth error={!!errors.startTime}>
                <DateTimePicker
                  label="Start Time"
                  value={draft.startTime !== null ? new Date(draft.startTime) : null}
                  onChange={(date) => draft.set('startTime', date ? date.getTime() : null)}
                  onAccept={(date) => draft.set('startTime', date ? date.getTime() : null)}
                  format="MM/dd/yy HH:mm"
                />
                <FormHelperText>{errors.startTime}</FormHelperText>
              </FormControl>
            </Grid>

            <Grid size={12}>
              <FormControl fullWidth>
                <TextField value={draft.description} onChange={(e) => draft.set('description', e.target.value)} multiline variant="outlined" label="Description" />
                <FormHelperText></FormHelperText>
              </FormControl>
            </Grid>

            <Grid container size={12} spacing={1} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Grid size={12}>
                  <FormGroup>
                    <FormControlLabel control={<Switch checked={draft.standbyOnly} onChange={(e) => draft.set('standbyOnly', e.target.checked)} color="primary" />} label="Standby Only" />
                  </FormGroup>
                </Grid>

                {isNew && (
                  <Grid size={12} sx={{ my: 1 }}>
                    <Box>{org.title} will start as a participating unit.</Box>
                  </Grid>
                )}
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                  <Button onClick={() => window.history.back()}>Cancel</Button>
                  <Button type="submit" variant="contained">
                    Save {selectedType === 'missions' ? 'Mission' : 'Event'}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </ToolbarPage>
  );
});
