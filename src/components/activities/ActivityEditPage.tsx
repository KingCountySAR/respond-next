'use client';
import AddLocation from '@mui/icons-material/AddLocation';
import Edit from '@mui/icons-material/Edit';
import { Box, Button, FormControl, FormControlLabel, FormGroup, FormHelperText, Grid, IconButton, InputLabel, MenuItem, Paper, Select, Stack, Switch, TextField } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Controller, Resolver, ResolverResult, SubmitHandler, useForm } from 'react-hook-form';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector, defaultEarlySigninWindow, earlySignInWindowOptions, isFuture } from '@respond/lib/client/store/activities';
import { ActivityActions } from '@respond/lib/state';
import { Activity, ActivityType, createNewActivity, OrganizationStatus } from '@respond/types/activity';

import { LocationAutocomplete } from '../locations/LocationAutocomplete';
import { LocationEditDialog } from '../locations/LocationEditDialog';

/**
 * Validation resolver
 * @param values
 * @returns
 */
const resolver: Resolver<Activity> = async (values) => {
  const result: ResolverResult<Activity> = {
    values: values.id ? values : {},
    errors: {},
  };

  if (!values.title) {
    result.errors.title = { type: 'required', message: 'Name is required' };
  }

  if (!values.location?.title) {
    result.errors.location = {
      type: 'required',
      message: 'Location is required',
    };
  }

  if (isNaN(values.startTime)) {
    result.errors.startTime = {
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

  return result;
};

/**
 *
 */
export const ActivityEditPage = ({ activityType, activityId }: { activityType: ActivityType; activityId?: string }) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const org = useAppSelector((state) => state.organization.mine);
  const selectedActivity = useAppSelector(buildActivitySelector(activityId));

  const [showLocationEditDialog, setShowLocationEditDialog] = useState(false);

  const permProp = activityType === 'missions' ? 'canCreateMissions' : 'canCreateEvents';
  const ownerOptions = [...(org?.[permProp] ? [org] : []), ...(org?.partners.filter((p) => p[permProp]) ?? [])];
  const isNew = !selectedActivity;

  let activity: Activity;
  if (isNew) {
    activity = {
      ...createNewActivity(),
      ownerOrgId: ownerOptions[0].id,
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

  useEffect(() => {
    focusRef.current?.focus();
  }, [focusRef]);

  if (!org) {
    return <Box>Waiting for org...</Box>;
  }

  const onSubmit: SubmitHandler<Activity> = (data) => {
    const time = new Date().getTime();
    const updated = { ...data, startTime: new Date(data.startTime).getTime() };

    dispatch(ActivityActions.update(updated));

    function addOwnerOrg() {
      if (org && activity?.organizations[updated.ownerOrgId] === undefined) {
        const ownerOrg = updated.ownerOrgId === org.id ? org : org.partners.find((f) => f.id === updated.ownerOrgId)!;
        const status = org.id === updated.ownerOrgId ? (updated.startTime <= time ? OrganizationStatus.Responding : OrganizationStatus.Standby) : OrganizationStatus.Unknown;
        dispatch(
          ActivityActions.appendOrganizationTimeline(
            updated.id,
            {
              id: ownerOrg.id,
              title: ownerOrg.title,
              rosterName: ownerOrg.rosterName,
            },
            { status, time },
          ),
        );
      }
    }

    if (isNew) {
      dispatch(
        ActivityActions.appendOrganizationTimeline(
          updated.id,
          { id: org.id, title: org.title, rosterName: org.rosterName },
          {
            status: updated.startTime <= time ? OrganizationStatus.Responding : OrganizationStatus.Standby,
            time,
          },
        ),
      );
      if (updated.ownerOrgId !== org.id) {
        addOwnerOrg();
      }
    } else {
      addOwnerOrg();
    }

    // We're optimistic that the submitted event will be processed successfully. With partially offline clients,
    // we may not know of a conflict/etc. until later and will have to have UI for that anyways.
    router.push(`/${activityType === 'missions' ? 'mission' : 'event'}/${updated.id}`);
  };

  return (
    <ToolbarPage>
      <Paper>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container padding={2} spacing={2} alignItems="center">
            <Grid item xs={12}>
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

            <Grid item xs={12}>
              <Stack direction={'row'} spacing={2} alignItems={'center'}>
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
                <Box paddingRight={2}>
                  <IconButton color="default" onClick={() => setShowLocationEditDialog(true)}>
                    {watchLocation?.title ? <Edit /> : <AddLocation />}
                  </IconButton>
                </Box>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6}>
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

            <Grid item xs={12} sm={6}>
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

            <Grid item xs={12} sm={6}>
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

            <Grid item xs={12} sm={6}>
              <Controller
                name="earlySignInWindow"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.earlySignInWindow?.message} disabled={!isFuture(watch('startTime'))}>
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

            <Grid item xs={12} sm={6}>
              <Controller
                name="startTime"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.startTime?.message}>
                    <DateTimePicker
                      label="Start Time"
                      value={field.value}
                      inputRef={field.ref}
                      onAccept={(date) => {
                        field.onChange(date);
                      }}
                      format="MM/dd/yy HH:mm"
                    />
                    <FormHelperText>{errors.startTime?.message}</FormHelperText>
                  </FormControl>
                )}
              />
            </Grid>

            <Grid item xs={12}>
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

            <Grid container item xs={12} spacing={1} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                {activityType === 'missions' ? null : (
                  <Grid item xs={12}>
                    <FormGroup>
                      <Controller name="asMission" control={control} render={({ field }) => <FormControlLabel control={<Switch {...field} checked={field.value} color="primary" />} label="Run as mock mission" />} />
                    </FormGroup>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <FormGroup>
                    <Controller name="forceStandbyOnly" control={control} render={({ field }) => <FormControlLabel control={<Switch {...field} checked={field.value} color="primary" />} label="Standby Only" />} />
                  </FormGroup>
                </Grid>

                {isNew && (
                  <Grid item xs={12} sx={{ my: 1 }}>
                    <Box>{org.title} will start as a participating unit.</Box>
                  </Grid>
                )}
              </Grid>

              <Grid item xs={12} sm={6}>
                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  <Button onClick={() => router.back()}>Cancel</Button>
                  <Button type="submit" variant="contained">
                    Save {activityType === 'missions' ? 'Mission' : 'Event'}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Grid>
        </form>

        <LocationEditDialog
          location={watchLocation ?? undefined}
          open={showLocationEditDialog}
          onSubmit={(location) => {
            setValue('location', location);
          }}
          onClose={() => setShowLocationEditDialog(false)}
        />
      </Paper>
    </ToolbarPage>
  );
};
