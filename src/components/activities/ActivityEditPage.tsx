'use client';
import { Autocomplete, Box, Button, CircularProgress, FormControl, FormControlLabel, FormGroup, FormHelperText, Grid, InputLabel, MenuItem, Select, Stack, Switch, TextField } from '@mui/material';
import { parse as parseDate } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Controller, Resolver, ResolverResult, SubmitHandler, useForm } from 'react-hook-form';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { apiFetch } from '@respond/lib/api';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector, defaultEarlySigninWindow, earlySignInWindowOptions, isFuture } from '@respond/lib/client/store/activities';
import * as FormUtils from '@respond/lib/formUtils';
import { ActivityActions } from '@respond/lib/state';
import { Activity, ActivityType, createNewActivity, OrganizationStatus } from '@respond/types/activity';
import { LocationDoc } from '@respond/types/data/locationDoc';
import { createNewLocation } from '@respond/types/location';

const getLocations = async () => {
  return (await apiFetch<{ data: LocationDoc[] }>(`/api/v1/locations`)).data;
};

type FormDateTime = { date: string; time: string };
type ActivityFormValues = FormUtils.ReplacedType<Activity, number, FormDateTime, ['startTime']>;

function parseFormDateTime(dateTime: FormDateTime) {
  return parseDate(`${dateTime.date} ${dateTime.time}`, 'yyyy-MM-dd HHmm', new Date());
}

function isFutureFormDate(dateTime: FormDateTime) {
  const date = parseFormDateTime(dateTime);
  return isFuture(date.getTime());
}

/**
 * Validation resolver
 * @param values
 * @returns
 */
const resolver: Resolver<ActivityFormValues> = async (values) => {
  const result: ResolverResult<ActivityFormValues> = {
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

  const parsed = parseFormDateTime(values.startTime);
  if (isNaN(parsed.getTime())) {
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

  const permProp = activityType === 'missions' ? 'canCreateMissions' : 'canCreateEvents';
  const ownerOptions = [...(org?.[permProp] ? [org] : []), ...(org?.partners.filter((p) => p[permProp]) ?? [])];
  const isNew = !selectedActivity;

  const [locationOpen, setLocationOpen] = useState(false);
  const [locationOptions, setLocationOptions] = useState<LocationDoc[]>([]);
  const loadingLocations = locationOpen && locationOptions.length === 0;

  useEffect(() => {
    if (!loadingLocations) {
      return undefined;
    }
    getLocations().then((options) => {
      setLocationOptions(options);
    });
  }, [loadingLocations]);

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

  const defaultValues = FormUtils.toExpandedDates(activity, 'startTime');

  // Sanitize stored values
  const initialEarlySignInWindow = defaultValues.earlySignInWindow;
  if (initialEarlySignInWindow == undefined || initialEarlySignInWindow == null || typeof initialEarlySignInWindow != 'number') {
    defaultValues.earlySignInWindow = defaultEarlySigninWindow;
  }

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ActivityFormValues>({
    resolver,
    defaultValues,
  });

  const focusRef = useRef<HTMLInputElement>();

  useEffect(() => {
    focusRef.current?.focus();
  }, [focusRef]);

  if (!org) {
    return <Box>Waiting for org...</Box>;
  }

  const onSubmit: SubmitHandler<ActivityFormValues> = (data) => {
    const time = new Date().getTime();
    const updated = FormUtils.fromExpandedDates(data, 'startTime');

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

  // TODO: Attempt to Parse Lat/Lon and/or Addresses
  const parseLocation = (value: string) => {
    return createNewLocation(value);
  };

  return (
    <ToolbarPage>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={1}>
          <Grid item xs={12}>
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.title?.message}>
                  <TextField {...field} inputRef={focusRef} variant="filled" label="Name" required />
                  <FormHelperText>{errors.title?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="location"
              control={control}
              render={({ field: { onChange } }) => (
                <FormControl fullWidth error={!!errors.location?.message}>
                  <Autocomplete
                    open={locationOpen}
                    onOpen={() => setLocationOpen(true)}
                    onClose={() => setLocationOpen(false)}
                    disablePortal
                    freeSolo={true}
                    options={locationOptions}
                    onChange={(event, value) => onChange(typeof value === 'string' ? { title: value } : value)}
                    onInputChange={(event, value) => onChange(parseLocation(value))}
                    getOptionLabel={(option) => (typeof option === 'string' ? option : option.title)}
                    value={activity.location}
                    renderOption={(props, option) => {
                      return (
                        <li {...props} key={option.title}>
                          {option.title}
                        </li>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        variant="filled"
                        label="Location"
                        required
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {loadingLocations ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />

                  {/*<LocationInput {...field} onChange={field.onChange} variant="filled" label="Location" required />*/}
                  {/*<TextField {...field} variant="filled" label="Location" required />*/}
                  <FormHelperText>{errors.location?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="mapId"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <TextField {...field} variant="filled" label="Map Id" />
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
                  <TextField {...field} variant="filled" label="State Number" />
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
                  <InputLabel variant="filled">Responsible Agency</InputLabel>
                  <Select {...field} variant="filled" label="Responsible Agency">
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
                <FormControl fullWidth error={!!errors.earlySignInWindow?.message} disabled={!isFutureFormDate(watch('startTime'))}>
                  <InputLabel variant="filled">Early Sign In Window</InputLabel>
                  <Select {...field} variant="filled" label="Early Sign In Window">
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

          <Grid item xs={12}>
            <FormControl fullWidth error={!!errors.startTime?.message || !!errors.startTime?.date?.message || !!errors.startTime?.time?.message}>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <Controller name="startTime.date" control={control} render={({ field }) => <TextField {...field} fullWidth variant="filled" label="Start Date" required />} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Controller name="startTime.time" control={control} render={({ field }) => <TextField {...field} fullWidth variant="filled" label="Start Time" required />} />
                </Grid>
              </Grid>
              <FormHelperText>{errors.startTime?.message}</FormHelperText>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.title?.message}>
                  <TextField {...field} multiline variant="filled" label="Description" />
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
    </ToolbarPage>
  );
};
