'use client';
import { Box, Button, FormControl, FormControlLabel, FormGroup, FormHelperText, Grid, InputLabel, MenuItem, Select, Stack, Switch, TextField } from '@mui/material';
import { parse as parseDate } from 'date-fns';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Controller, Resolver, ResolverResult, SubmitHandler, useForm } from 'react-hook-form';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector, defaultEarlySigninWindow } from '@respond/lib/client/store/activities';
import * as FormUtils from '@respond/lib/formUtils';
import { ActivityActions } from '@respond/lib/state';
import { Activity, ActivityType, createNewActivity, OrganizationStatus } from '@respond/types/activity';

import NumberInput from '../NumberInput';

type ActivityFormValues = FormUtils.ReplacedType<Activity, number, { date: string; time: string }, ['startTime']>;

const maxEarlySigninWindow = 48;

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

  const parsed = parseDate(`${values.startTime.date} ${values.startTime.time}`, 'yyyy-MM-dd HHmm', new Date());
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
  let activity = useAppSelector(buildActivitySelector(activityId));

  const permProp = activityType === 'missions' ? 'canCreateMissions' : 'canCreateEvents';
  const ownerOptions = [...(org?.[permProp] ? [org] : []), ...(org?.partners.filter((p) => p[permProp]) ?? [])];
  const isNew = !activity;
  if (isNew) {
    activity = {
      ...createNewActivity(),
      ownerOrgId: ownerOptions[0].id,
      isMission: activityType === 'missions',
      asMission: activityType === 'missions',
    };
  }

  const defaultValues = activity ? FormUtils.toExpandedDates(activity, 'startTime') : undefined;

  if (defaultValues) {
    let initialEarlySignInWindow = defaultValues.earlySignInWindow;

    // Force it to a number, as it's stored as a string.
    initialEarlySignInWindow = initialEarlySignInWindow ? Number(initialEarlySignInWindow) : defaultEarlySigninWindow;

    // The stored value is milliseconds, but we want to edit in hours. Convert to hours.
    defaultValues.earlySignInWindow = initialEarlySignInWindow / 1000 / 60 / 60;
  }

  const {
    control,
    handleSubmit,
    formState: { errors },
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

    // Convert the hours the user was editing back to milliseconds for saving.
    updated.earlySignInWindow = updated.earlySignInWindow ? updated.earlySignInWindow * 60 * 60 * 1000 : undefined;

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
      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={1} sx={{ mb: 4 }}>
          {/* Mission  */}
          <Grid item xs={12}>
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

              <Grid item xs={12} sm={6}>
                <Controller
                  name="location.title"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.location?.message}>
                      <TextField {...field} variant="filled" label="Location" required />
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
            </Grid>
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

          {activityType === 'missions' ? null : (
            <Grid item xs={12}>
              <FormGroup>
                <Controller name="asMission" control={control} render={({ field }) => <FormControlLabel control={<Switch {...field} color="primary" />} label="Run as mock mission" />} />
              </FormGroup>
            </Grid>
          )}

          {isNew && (
            <Grid item xs={12}>
              <Box sx={{ mt: 2 }}>{org.title} will start as a participating unit.</Box>
            </Grid>
          )}

          <Grid item xs={12}>
            <Stack direction="row" justifyContent="space-between">
              <Controller
                name="earlySignInWindow"
                control={control}
                render={({ field }) => {
                  return (
                    <FormControl error={!!errors.earlySignInWindow?.message}>
                      <Stack direction="column">
                        <div>Early Sign In Window</div>
                        <NumberInput
                          field={field}
                          props={{
                            min: 0,
                            max: maxEarlySigninWindow,
                            endAdornment: 'hours',
                          }}
                        />
                      </Stack>
                    </FormControl>
                  );
                }}
              />
              <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                <Button onClick={() => router.back()}>Cancel</Button>
                <Button type="submit" variant="contained">
                  Save {activityType === 'missions' ? 'Mission' : 'Event'}
                </Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </form>
    </ToolbarPage>
  );
};
