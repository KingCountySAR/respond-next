import AddLocation from '@mui/icons-material/AddLocation';
import Edit from '@mui/icons-material/Edit';
import { Box, Button, FormControl, FormControlLabel, FormGroup, FormHelperText, Grid, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { useEffect, useMemo, useRef } from 'react';
import { Controller, Resolver, ResolverResult, SubmitHandler, useForm } from 'react-hook-form';
import { useLocation } from 'wouter';

import { useDialogs } from '@respond/components/DialogProvider';
import { LocationAutocomplete } from '@respond/components/locations/LocationAutocomplete';
import { LocationEditDialog } from '@respond/components/locations/LocationEditDialog';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useActivityCommands } from '@respond/lib/client/services/activity';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector } from '@respond/lib/client/store/activities';
import { Activity, ActivityType, createNewActivity, defaultEarlySigninWindow, earlySignInWindowOptions, OrganizationStatus } from '@respond/shared/types/activity';

/**
 * Validation resolver
 * @param values
 * @returns
 */
const resolver: Resolver<Activity> = async (values) => {
  const errors: Record<string, { type: string; message: string }> = {};

  if (!values.title) {
    errors.title = { type: 'required', message: 'Name is required' };
  }

  if (!values.location?.title) {
    errors.location = {
      type: 'required',
      message: 'Location is required',
    };
  }

  if (isNaN(values.startTime)) {
    errors.startTime = {
      type: 'validate',
      message: 'Invalid start time',
    };
  }

  if (values.mapId) {
    const urlParts = values.mapId.split('/');
    if (urlParts.length > 1) {
      values.mapId = urlParts[urlParts.length - 1];
    }
  }

  return { values: values.id ? values : {}, errors } as unknown as ResolverResult<Activity>;
};

/**
 *
 */
export const ActivityEditPage = ({ activityType, activityId }: { activityType: ActivityType; activityId?: string }) => {
  const activityCommands = useActivityCommands();
  const [, navigate] = useLocation();
  const org = useAppSelector((state) => state.organization.mine);
  const selectedActivity = useAppSelector(buildActivitySelector(activityId));
  const { open } = useDialogs();

  const permProp = activityType === 'missions' ? 'canCreateMissions' : 'canCreateEvents';
  const initialOwnerOptions = [...(org?.[permProp] ? [org] : []), ...(org?.partners.filter((p) => p[permProp]) ?? [])];
  const isNew = !selectedActivity;

  let activity: Activity;
  if (isNew) {
    activity = {
      ...createNewActivity(),
      ownerOrgId: initialOwnerOptions[0]?.id ?? '',
      isMission: activityType === 'missions',
      asMission: activityType === 'missions',
    };
  } else {
    activity = selectedActivity;
  }

  const defaultValues = { ...activity };

  // Sanitize stored values
  const initialEarlySignInWindow = defaultValues.earlySignInWindow;
  if (initialEarlySignInWindow == undefined || initialEarlySignInWindow == null || typeof initialEarlySignInWindow != 'number') {
    defaultValues.earlySignInWindow = defaultEarlySigninWindow;
  }

  const initialOwnerOrgId = useRef(defaultValues.ownerOrgId);
  const initialSelectedType = useRef(defaultValues.isMission ? 'missions' : 'events');

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
    watch,
  } = useForm<Activity>({
    resolver,
    defaultValues,
  });

  const focusRef = useRef<HTMLInputElement>();
  const watchLocation = watch('location');
  const selectedIsMission = watch('isMission');
  const selectedType = selectedIsMission ? 'missions' : 'events';
  const selectedOwnerOrgId = watch('ownerOrgId');

  const permissionProp = selectedType === 'missions' ? 'canCreateMissions' : 'canCreateEvents';
  const ownerOptions = useMemo(() => [...(org?.[permissionProp] ? [org] : []), ...(org?.partners.filter((p) => p[permissionProp]) ?? [])], [org, permissionProp]);

  useEffect(() => {
    focusRef.current?.focus();
  }, [focusRef]);

  useEffect(() => {
    if (!ownerOptions.length) {
      return;
    }

    const currentOwnerIsValid = selectedOwnerOrgId && ownerOptions.some((o) => o.id === selectedOwnerOrgId);
    if (currentOwnerIsValid) {
      return;
    }

    const initialOwnerMatchesCurrentType = selectedType === initialSelectedType.current;
    const initialOwnerIsAvailable = ownerOptions.some((o) => o.id === initialOwnerOrgId.current);
    if (initialOwnerMatchesCurrentType && initialOwnerIsAvailable) {
      setValue('ownerOrgId', initialOwnerOrgId.current);
      return;
    }

    setValue('ownerOrgId', ownerOptions[0].id);
  }, [ownerOptions, selectedOwnerOrgId, selectedType, setValue]);

  if (!org) {
    return <Box>Waiting for org...</Box>;
  }

  const onSubmit: SubmitHandler<Activity> = (data) => {
    const time = new Date().getTime();
    const updated = { ...data, startTime: new Date(data.startTime).getTime() };

    activityCommands.update(updated);

    function addOwnerOrg() {
      if (org && activity?.organizations[updated.ownerOrgId] === undefined) {
        const ownerOrg = updated.ownerOrgId === org.id ? org : org.partners.find((f) => f.id === updated.ownerOrgId)!;
        const status = org.id === updated.ownerOrgId ? (updated.startTime <= time ? OrganizationStatus.Responding : OrganizationStatus.Standby) : OrganizationStatus.Unknown;
        activityCommands.appendOrganizationTimeline(
          updated.id,
          {
            id: ownerOrg.id,
            title: ownerOrg.title,
            rosterName: ownerOrg.rosterName,
          },
          { status, time },
        );
      }
    }

    if (isNew) {
      activityCommands.appendOrganizationTimeline(
        updated.id,
        { id: org.id, title: org.title, rosterName: org.rosterName },
        {
          status: updated.startTime <= time ? OrganizationStatus.Responding : OrganizationStatus.Standby,
          time,
        },
      );
      if (updated.ownerOrgId !== org.id) {
        addOwnerOrg();
      }
    } else {
      addOwnerOrg();
    }

    // We're optimistic that the submitted event will be processed successfully. With partially offline clients,
    // we may not know of a conflict/etc. until later and will have to have UI for that anyways.
    navigate(`~/${updated.isMission ? 'mission' : 'event'}/${updated.id}`);
  };

  return (
    <ToolbarPage>
      <Paper>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2} sx={{ padding: 2, alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.title?.message}>
                    <TextField {...field} inputRef={focusRef} variant="outlined" label="Name" required />
                    <FormHelperText>{errors.title?.message}</FormHelperText>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="isMission"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel id="activity-type-label">Type</InputLabel>
                    <Select {...field} labelId="activity-type-label" label="Type" value={field.value ? 'missions' : 'events'} onChange={(event) => field.onChange(event.target.value === 'missions')}>
                      <MenuItem value="missions">Mission</MenuItem>
                      <MenuItem value="events">Event</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid size={12}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Controller
                  name="location"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <FormControl fullWidth error={!!errors.location?.message}>
                      <LocationAutocomplete value={value} onChange={onChange} variant="outlined" required />
                      <FormHelperText>{errors.location?.message}</FormHelperText>
                    </FormControl>
                  )}
                />
                <Box sx={{ paddingRight: 2 }}>
                  <IconButton
                    color="default"
                    onClick={() => {
                      open(LocationEditDialog, {
                        location: watchLocation,
                        onSubmit: (location) => {
                          setValue('location', location);
                        },
                      });
                    }}
                  >
                    {watchLocation?.title ? <Edit /> : <AddLocation />}
                  </IconButton>
                </Box>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="mapId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <TextField {...field} variant="outlined" label="Map Id" />
                    <FormHelperText></FormHelperText>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="idNumber"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.idNumber?.message}>
                    <TextField {...field} variant="outlined" label="State Number" />
                    <FormHelperText>{errors.idNumber?.message}</FormHelperText>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="ownerOrgId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.ownerOrgId?.message}>
                    <InputLabel variant="outlined">Responsible Agency</InputLabel>
                    <Select {...field} variant="outlined" label="Responsible Agency">
                      {ownerOptions.map((p) => (
                        <MenuItem key={p.id} value={p.id}>
                          {p.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="earlySignInWindow"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.earlySignInWindow?.message} disabled={!(watch('startTime') > Date.now())}>
                    <InputLabel variant="outlined">Early Sign In Window</InputLabel>
                    <Select {...field} variant="outlined" label="Early Sign In Window">
                      {earlySignInWindowOptions.map((p) => (
                        <MenuItem key={p.value} value={p.value}>
                          {p.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="startTime"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.startTime?.message}>
                    <DateTimePicker
                      label="Start Time"
                      value={field.value ? new Date(field.value) : null}
                      inputRef={field.ref}
                      onChange={(date) => {
                        field.onChange(date ? date.getTime() : null);
                      }}
                      onAccept={(date) => {
                        field.onChange(date ? date.getTime() : null);
                      }}
                      format="MM/dd/yy HH:mm"
                    />
                    <FormHelperText>{errors.startTime?.message}</FormHelperText>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid size={12}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.title?.message}>
                    <TextField {...field} multiline variant="outlined" label="Description" />
                    <FormHelperText>{errors.title?.message}</FormHelperText>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid container size={12} spacing={1} sx={{ mt: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                {/* {activityType === 'missions' ? null : (
                  <Grid size={12}>
                    <FormGroup>
                      <Controller name="asMission" control={control} render={({ field }) => <FormControlLabel control={<Switch {...field} checked={field.value} color="primary" />} label="Run as mock mission" />} />
                    </FormGroup>
                  </Grid>
                )} */}

                <Grid size={12}>
                  <FormGroup>
                    <Controller name="forceStandbyOnly" control={control} render={({ field }) => <FormControlLabel control={<Switch {...field} checked={field.value} color="primary" />} label="Standby Only" />} />
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
};
