'use client';
import React, { useEffect, useRef } from "react";
import { useRouter } from 'next/navigation';
//import { Link as Link, useNavigate, useParams } from "react-router-dom";
import { useForm, Controller, SubmitHandler, Resolver, ResolverResult } from "react-hook-form";
import { Box, Button, FormControl, FormControlLabel, FormHelperText, FormGroup, Stack, Switch, TextField, InputLabel, Select, MenuItem } from "@mui/material";
import { parse as parseDate } from "date-fns";

// import { useAppSelector, useAppDispatch } from "../../app/hooks";
import * as FormUtils from "@respond/lib/formUtils";
import { Activity, ActivityType, createNewActivity, OrganizationStatus } from '@respond/types/activity';
import { useAppDispatch, useAppSelector } from '@respond/lib/client/store';
import { ActivityActions, buildActivitySelector } from '@respond/lib/client/store/activities';
// import { MemberEnvironment } from "../../features/environment";
// import { buildActivitySelector } from "../../features/activities/activitySelectors";
// import { ActivityActions } from "../../features/activities";
// import { Activity, ActivityType, createNewActivity, OrganizationStatus } from "../../features/activities/activityModel";

type EventFormValues = FormUtils.ReplacedType<Activity, number, { date: string, time: string }, ['startTime']>;

/**
 * Validation resolver
 * @param values 
 * @returns 
 */
const resolver: Resolver<EventFormValues> = async (values) => {
  const result: ResolverResult<EventFormValues> = {
    values: values.id ? values : {},
    errors: {}
  };

  if (!values.title) {
    result.errors.title = { type: 'required', message: 'Name is required' };
  }

  if (!values.location?.title) {
    result.errors.location = { type: 'required', message: 'Location is required' };
  }

  const parsed = parseDate(`${values.startTime.date} ${values.startTime.time}`, 'yyyy-MM-dd HHmm', new Date());
  if (isNaN(parsed.getTime())) {
    result.errors.startTime = { type: 'validate', message: 'Invalid start time' };
  }

  return result;
};

/**
 * 
 */
export const EventEditor = ({ activityType, eventId }: { activityType: ActivityType, eventId?: string}) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const org = useAppSelector(state => state.organization.mine);
  let activity = useAppSelector(buildActivitySelector(eventId));

  const permProp = activityType === 'missions' ? 'canCreateMissions' : 'canCreateEvents';
  const ownerOptions = [
    ...(org?.[permProp] ? [org] : []),
    ...(org?.partners.filter(p => p[permProp]) ?? []),
  ]
  const isNew = !activity;
  if (isNew) {
    activity = {
      ...createNewActivity(),
      ownerOrgId: ownerOptions[0].id,
      isMission: activityType === 'missions',
      asMission: activityType === 'missions',
    };
  }

  const { control, handleSubmit, formState: { errors } } = useForm<EventFormValues>({
    resolver,
    defaultValues: activity ? FormUtils.toExpandedDates(activity, 'startTime') : undefined,
  });

  const focusRef = useRef<HTMLInputElement>();

  useEffect(() => {
    focusRef.current?.focus();
  }, [ focusRef ]);

  if (!org) {
    return (<Box>Waiting for org...</Box>);
  }

  const onSubmit: SubmitHandler<EventFormValues> = data => {
    const time = new Date().getTime();
    const updated = FormUtils.fromExpandedDates(data, 'startTime');
    
    dispatch(ActivityActions.update(updated));

    function addOwnerOrg() {
      if (org && activity?.organizations[updated.ownerOrgId] === undefined) {
        let ownerOrg = updated.ownerOrgId === org.id ? org : org.partners?.find(f => f.id === updated.ownerOrgId)!;
        const status = org.id === updated.ownerOrgId ? (updated.startTime <= time ? OrganizationStatus.Responding : OrganizationStatus.Standby) : OrganizationStatus.Unknown;
        dispatch(ActivityActions.appendOrganizationTimeline(
          updated.id,
          { id: ownerOrg.id, title: ownerOrg.title, rosterName: ownerOrg.rosterName},
          { status, time },
        ));
      }
    }

    if (isNew) {
      dispatch(ActivityActions.appendOrganizationTimeline(
        updated.id,
        { id: org.id, title: org.title, rosterName: org.rosterName},
        { status: updated.startTime <= time ? OrganizationStatus.Responding : OrganizationStatus.Standby, time },
      ));
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

  return (<>
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={1}>
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors.title?.message}>
              <TextField {...field} inputRef={focusRef} variant="filled" label="Name" />
              <FormHelperText>{errors.title?.message}</FormHelperText>
            </FormControl>
          )}
        />

        <Controller
          name="location.title"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors.location?.message}>
              <TextField {...field} variant="filled" label="Location" />
              <FormHelperText>{errors.location?.message}</FormHelperText>
            </FormControl>
          )}
        />

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

        <Controller
          name="ownerOrgId"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors.ownerOrgId?.message}>
              <InputLabel variant="filled">Responsible Agency</InputLabel>
              <Select  {...field} variant="filled" label="Responsible Agency">
                {ownerOptions.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        <FormControl fullWidth error={!!errors.startTime?.message || !!errors.startTime?.date?.message || !!errors.startTime?.time?.message}>
          <Box>
            <Controller
              name="startTime.date"
              control={control}
              render={({ field }) => <TextField {...field} fullWidth variant="filled" label="Start Date" sx={{ width: 1 / 2 }} />}
            />
            <Controller
              name="startTime.time"
              control={control}
              render={({ field }) => <TextField {...field} fullWidth variant="filled" label="Start Time" sx={{ width: 1 / 2 }} />}
            />
          </Box>
          <FormHelperText>{errors.startTime?.message}</FormHelperText>
        </FormControl>

        {activityType === 'missions' ? null : (
          <FormGroup>
            <Controller
              name="asMission"
              control={control}
              render={({field}) => <FormControlLabel control={<Switch {...field} color="primary" />} label="Run as mock mission" />}
            />
          </FormGroup>
        )}

        {isNew && (
          <Box sx={{mt: 2}}>
            {org.title} will start as a participating unit.
          </Box>
        )}

        <Stack direction="row" spacing={1} sx={{mt: 2}}>
          <Button type="submit" variant="contained">Save {activityType === 'missions' ? 'Mission' : 'Event'}</Button>
          <Button onClick={() => router.back()}>Cancel</Button>
        </Stack>
      </Stack>
    </form>
  </>
  );
};