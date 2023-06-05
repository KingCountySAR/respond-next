import { useState } from 'react';
import { Box, DialogContentText, FormControl, FormHelperText, Radio, RadioGroup, TextField, Typography, Select, MenuItem, Stack } from '../Material';
import { useAppDispatch } from '@respond/lib/client/store';
import { ActivityActions } from '@respond/lib/state';
import { Activity, Participant, ResponderStatus } from '@respond/types/activity';
import { UserInfo } from '@respond/types/userInfo';
import { Control, Controller, FieldErrors, Resolver, ResolverResult, SubmitHandler, useForm } from 'react-hook-form';
import { FormControlLabel } from '@mui/material';

interface FormValues {
  miles: number|'',
  addMiles: number|'',
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
    defaultValues: { miles: participant?.miles ?? '', addMiles: '' },
  });
  if (form.getValues().miles !== (participant?.miles ?? '')) {
    form.reset({ miles: participant?.miles ?? '', addMiles: '' });
  }


  const onSubmit: SubmitHandler<FormValues> = data => {

    if (data.addMiles !== undefined) {
      data.miles = Number(data.miles ?? 0) + Number(data.addMiles);
    }

    dispatch(ActivityActions.participantUpdate(
      activity.id,
      user.participantId,
      user.given_name ?? '',
      user.family_name ?? '',
      respondingOrgId,
      new Date().getTime(),
      newStatus,
      data.miles === '' ? undefined : data.miles,
    ));
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
type FormType = ReturnType<typeof useFormLogic>;

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

const MileageSection = ({ existingMiles, form: { control, errors, getValues, setValue } }: { form: FormType, existingMiles: number|undefined }) => {
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

export const UpdateStatusForm = ({ form }: { form: FormType }) => {
  const { activity, participant, newStatus } = form.context;

  return (
    <Stack spacing={2} alignItems="flex-start">
      <DialogContentText id="status-update-dialog-description">
        Change your status for {activity.title}?
      </DialogContentText>
      {newStatus === ResponderStatus.SignedOut ? <MileageSection form={form} existingMiles={participant?.miles} /> : undefined}
    </Stack>
  );
}
