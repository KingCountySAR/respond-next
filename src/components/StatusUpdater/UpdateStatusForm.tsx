import { FormControlLabel } from '@mui/material';
import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { Activity, Participant, ResponderStatus } from '@respond/types/activity';
import { UserInfo } from '@respond/types/userInfo';
import { useState } from 'react';
import { Control, Controller, FieldErrors, Resolver, ResolverResult, SubmitHandler, useForm } from 'react-hook-form';
import { Box, DialogContentText, FormControl, FormHelperText, Radio, RadioGroup, Stack, TextField, Typography } from '../Material';
import { format as formatDate, parse as parseDate  } from "date-fns";

interface FormValues {
  miles: number|'',
  addMiles: number|'',
  statusTime: Date|'',
}

export function useFormLogic(
  activity: Activity,
  user: UserInfo,
  respondingOrgId: string,
  participant: Participant|undefined,
  currentStatus: ResponderStatus|undefined,
  newStatus: ResponderStatus,
  onFinish: () => void,
) {
  const dispatch = useAppDispatch();

  const resolver: Resolver<FormValues> = async (values) => {
    const result: ResolverResult<FormValues> = {
      values: values ? values : {},
      errors: {},
    };

    if (values.addMiles != null && values.addMiles < 0) {
      result.errors.addMiles = { type: 'min', message: 'Must be a positive number' };
    }
    if (values.miles != null && values.miles < 0) {
      result.errors.miles = { type: 'min', message: 'Must be a positive number' };
    }

    return result;
  }

  const form = useForm<FormValues>({
    resolver,
    defaultValues: { miles: participant?.miles ?? '', addMiles: '' , statusTime: ''},
  });
  if (form.getValues().miles !== (participant?.miles ?? '')) {
    form.reset({ miles: participant?.miles ?? '', addMiles: '' });
  }

  const onSubmit: SubmitHandler<FormValues> = data => {

    if (data.addMiles !== undefined) {
      data.miles = Number(data.miles ?? 0) + Number(data.addMiles);
    }

    console.log("##### onSubmit" );
    console.log("form.getValues().miles " + form.getValues().miles);
    console.log("form.getValues().addMiles " + form.getValues().addMiles);
    console.log("form.getValues().statusTime " + form.getValues().statusTime);

    dispatch(ActivityActions.participantUpdate(
      activity.id,
      user.participantId,
      user.given_name ?? '',
      user.family_name ?? '',
      respondingOrgId,
      (data.statusTime === '' ? new Date() : data.statusTime).getTime(),
      newStatus,
      data.miles === '' ? undefined : data.miles,
    ));

    // Clear form data so it doesn't carry over to the next status update.
    data.statusTime = '';
    data.addMiles = '';

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

export const TotalMilesInput = ({control, errors}: { control: Control<FormValues, any>, errors: FieldErrors<FormValues> }) => {
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
  )
};

const MileageSection = ({ existingMiles, form: { control, errors, getValues, setValue } }: { form: FormLogic, existingMiles: number|undefined }) => {
  const [ isTotalMiles, setIsTotalMiles ] = useState<boolean>(true);
  const [ addMilesPreview, setAddMilesPreview ] = useState<number|''>(getValues().addMiles);

  function handleMilesType(evt: React.ChangeEvent<HTMLInputElement>) {
    const v = evt.target.value === 'true';
    setIsTotalMiles(v);
    if (!v) {
      setValue('addMiles', '');
      setAddMilesPreview('');
    }
  }

  function handleAddMiles(evt: React.ChangeEvent<HTMLInputElement>) {
    let addMiles: number|'' = parseInt(evt.target.value);
    if (isNaN(addMiles)) {
      addMiles = '';
    }
    setValue('addMiles', addMiles);
    setAddMilesPreview(addMiles);
  }

  function formatMilesSum(existing: number|'', added: number|'') {
    if (existing === '' && added === '') {
      return undefined;
    }
    return Number(existing ?? 0) + Number(added ?? 0);
  }

  return (
    existingMiles == null ? (
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
        { isTotalMiles ? (
          <Box><TotalMilesInput control={control} errors={errors} /></Box>
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
    )
  );
}

export const StatusTimeInput = ({form: { control, errors, setValue }}: {form: FormLogic}) => {
  const currentTime = new Date();
  const [ statusTimeState, setStatusTimeState ] = useState<String>(() => {return formatDate(currentTime, "yyyy-MM-dd'T'HH:mm")});
  console.log("#### StatusTimeInput");
  console.log("statusTime=" + statusTimeState);

  function handleSetStatusTime(event: React.ChangeEvent<HTMLInputElement>) {
    console.log("#### handleSetStatusTime");

    const statusTimeAsDate = parseDate(event.target.value, "yyyy-MM-dd'T'HH:mm", new Date());
    setValue('statusTime', statusTimeAsDate);
    setStatusTimeState(event.target.value);
  }
  
  setValue('statusTime', currentTime);
  return (
    <Controller
      name="statusTime"
      control={control}
      render={({ field }) => (
        <FormControl error={!!errors.statusTime?.message}>
          <TextField {...field} type="datetime-local" variant="filled" size="small" value={statusTimeState}
           onChange={handleSetStatusTime} />
          <FormHelperText>{errors.statusTime?.message}</FormHelperText>
        </FormControl>
      )}
    />
  )
};

export const UpdateStatusForm = ({ form }: { form: FormLogic }) => {
  const { activity, participant, newStatus } = form.context;

  return (
    <Stack spacing={2} alignItems="flex-start">
      <DialogContentText id="status-update-dialog-description">
        Change your status for {activity.title}?
      </DialogContentText>
      <StatusTimeInput form={form} />
      {newStatus === ResponderStatus.SignedOut ? <MileageSection form={form} existingMiles={participant?.miles} /> : undefined}
    </Stack>
  );
}
