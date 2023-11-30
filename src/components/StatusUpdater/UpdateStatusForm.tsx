import { FormControlLabel } from '@mui/material';
import { format as formatDate, parse as parseDate } from 'date-fns';
import { useEffect, useState } from 'react';
import { Control, Controller, FieldErrors, Resolver, ResolverResult, SubmitHandler, useForm } from 'react-hook-form';

import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { Activity, OrganizationStatus, Participant, ParticipantStatus } from '@respond/types/activity';
import { MyOrganization } from '@respond/types/organization';
import { UserInfo } from '@respond/types/userInfo';

import { Box, DialogContentText, FormControl, FormHelperText, Radio, RadioGroup, Stack, TextField, Typography } from '../Material';
import { formatTimeAsString, TextBoxDateFormat } from '../RelativeTimeText';

interface FormValues {
  miles: number | '';
  addMiles: number | '';
  statusTime: string;
}

export function useFormLogic(activity: Activity, user: UserInfo, respondingOrg: MyOrganization, participant: Participant | undefined, currentStatus: ParticipantStatus | undefined, newStatus: ParticipantStatus, onFinish: () => void) {
  const dispatch = useAppDispatch();

  const resolver: Resolver<FormValues> = async (values) => {
    const result: ResolverResult<FormValues> = {
      values: values ? values : {},
      errors: {},
    };

    if (values.addMiles != null && values.addMiles < 0) {
      result.errors.addMiles = {
        type: 'min',
        message: 'Must be a positive number',
      };
    }
    if (values.miles != null && values.miles < 0) {
      result.errors.miles = {
        type: 'min',
        message: 'Must be a positive number',
      };
    }
    const statusTimeAsDate = parseDate(values.statusTime, TextBoxDateFormat, new Date());
    const lastStatusChangeTime = participant?.timeline[0].time;
    if (lastStatusChangeTime && !isNaN(lastStatusChangeTime) && statusTimeAsDate.getTime() < lastStatusChangeTime) {
      result.errors.statusTime = {
        type: 'min',
        message: 'Cannot be earlier than previous status change at ' + formatTimeAsString(lastStatusChangeTime, new Date().getTime(), false),
      };
    }

    return result;
  };

  const form = useForm<FormValues>({
    resolver,
    defaultValues: { miles: participant?.miles ?? '', addMiles: '', statusTime: '' },
  });
  if (form.getValues().miles !== (participant?.miles ?? '')) {
    form.reset({ miles: participant?.miles ?? '', addMiles: '' });
  }

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    if (data.addMiles !== undefined) {
      data.miles = Number(data.miles ?? 0) + Number(data.addMiles);
    }

    const statusTimeAsDate = parseDate(data.statusTime, TextBoxDateFormat, new Date());
    const time = statusTimeAsDate.getTime();

    if (!activity.organizations[respondingOrg.id]) {
      dispatch(
        ActivityActions.appendOrganizationTimeline(
          activity.id,
          {
            id: respondingOrg.id,
            title: respondingOrg.title,
            rosterName: respondingOrg.rosterName,
          },
          {
            status: newStatus === ParticipantStatus.Standby ? OrganizationStatus.Standby : OrganizationStatus.Responding,
            time: time,
          },
        ),
      );
    }
    dispatch(ActivityActions.participantUpdate(activity.id, user.participantId, user.given_name ?? '', user.family_name ?? '', respondingOrg.id, time, newStatus, data.miles === '' ? undefined : data.miles));
    onFinish();
  };

  return {
    ...form,
    errors: form.formState.errors,
    doSubmit: form.handleSubmit(onSubmit),
    context: {
      newStatus,
      activity,
      participant,
    },
  };
}
type FormLogic = ReturnType<typeof useFormLogic>;

export const TotalMilesInput = ({ control, errors }: { control: Control<FormValues>; errors: FieldErrors<FormValues> }) => {
  return (
    <Controller
      name="miles"
      control={control}
      render={({ field }) => (
        <FormControl error={!!errors.miles?.message}>
          <TextField {...field} type="number" variant="filled" size="small" label="Round-trip Miles" />
          <FormHelperText>{errors.miles?.message}</FormHelperText>
        </FormControl>
      )}
    />
  );
};

const MileageSection = ({ existingMiles, form: { control, errors, getValues, setValue } }: { form: FormLogic; existingMiles: number | undefined }) => {
  const [isTotalMiles, setIsTotalMiles] = useState<boolean>(true);
  const [addMilesPreview, setAddMilesPreview] = useState<number | ''>(getValues().addMiles);

  function handleMilesType(evt: React.ChangeEvent<HTMLInputElement>) {
    const v = evt.target.value === 'true';
    setIsTotalMiles(v);
    if (!v) {
      setValue('addMiles', '');
      setAddMilesPreview('');
    }
  }

  function handleAddMiles(evt: React.ChangeEvent<HTMLInputElement>) {
    let addMiles: number | '' = parseInt(evt.target.value);
    if (isNaN(addMiles)) {
      addMiles = '';
    }
    setValue('addMiles', addMiles);
    setAddMilesPreview(addMiles);
  }

  function formatMilesSum(existing: number | '', added: number | '') {
    if (existing === '' && added === '') {
      return undefined;
    }
    return Number(existing ?? 0) + Number(added ?? 0);
  }

  return existingMiles == null ? (
    <TotalMilesInput control={control} errors={errors} />
  ) : (
    <Box>
      <Typography>You currently have {existingMiles} round-trip miles.</Typography>
      <FormControl>
        <RadioGroup row value={isTotalMiles} onChange={handleMilesType}>
          <FormControlLabel value="true" control={<Radio size="small" />} label="Change total" />
          <FormControlLabel value="false" control={<Radio size="small" />} label="Add leg" />
        </RadioGroup>
      </FormControl>
      {isTotalMiles ? (
        <Box>
          <TotalMilesInput control={control} errors={errors} />
        </Box>
      ) : (
        <>
          <Box>
            <Controller
              name="addMiles"
              control={control}
              render={({ field }) => (
                <FormControl error={!!errors.miles?.message}>
                  <TextField {...field} onChange={handleAddMiles} type="number" variant="filled" size="small" label="Leg Miles" />
                  <FormHelperText>{errors.miles?.message}</FormHelperText>
                </FormControl>
              )}
            />
          </Box>
          <Typography>New Total Miles: {formatMilesSum(getValues().miles, addMilesPreview)}</Typography>
        </>
      )}
    </Box>
  );
};

export const StatusTimeInput = ({ form: { control, errors } }: { form: FormLogic }) => {
  return (
    <Controller
      name="statusTime"
      control={control}
      render={({ field }) => (
        <FormControl error={!!errors.statusTime?.message}>
          <TextField {...field} type="datetime-local" variant="filled" size="small" />
          <FormHelperText>{errors.statusTime?.message}</FormHelperText>
        </FormControl>
      )}
    />
  );
};

export const UpdateStatusForm = ({ form }: { form: FormLogic }) => {
  const { activity, participant, newStatus } = form.context;
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);

      // Reset the form as the same useForm object is reused.
      form.reset();

      const currentTime = new Date();
      const currentTimeAsString = formatDate(currentTime, TextBoxDateFormat);

      // Set fields with dynamic default values.
      form.setValue('miles', participant?.miles ?? '');
      form.setValue('statusTime', currentTimeAsString);
    }
  }, [isInitialized, form, participant?.miles]);

  return (
    <Stack spacing={2} alignItems="flex-start">
      <DialogContentText id="status-update-dialog-description">Change your status for {activity.title}?</DialogContentText>
      <StatusTimeInput form={form} />
      {newStatus === ParticipantStatus.SignedOut ? <MileageSection form={form} existingMiles={participant?.miles} /> : undefined}
    </Stack>
  );
};
