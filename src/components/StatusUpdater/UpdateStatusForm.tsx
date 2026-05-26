import CloseIcon from '@mui/icons-material/Close';
import { DateTimePicker } from '@mui/x-date-pickers';
import { useEffect, useState } from 'react';
import { Controller, Resolver, ResolverResult, SubmitHandler, useForm } from 'react-hook-form';

import { usePreferences } from '@respond/components/PreferencesProvider';
import { useAppDispatch } from '@respond/lib/client/store';
import { MemberInfo } from '@respond/lib/server/memberProviders/memberProvider';
import { ActivityActions } from '@respond/lib/state';
import { Activity, isEnrouteOrStandby, OrganizationStatus, Participant, ParticipantStatus } from '@respond/types/activity';
import { Organization } from '@respond/types/organization';
import { UserInfo } from '@respond/types/userInfo';

import { DialogContentText, FormControl, FormHelperText, IconButton, Stack } from '../Material';
import { ParticipantMilesInput } from '../participant/ParticipantMilesInput';
import { formatTime } from '../RelativeTimeText';

interface FormValues {
  eta?: number | undefined;
  miles: number | '';
  statusTime: number;
}

export function useFormLogic(activity: Activity, user: UserInfo | MemberInfo, respondingOrg: Organization, participant: Participant | undefined, currentStatus: ParticipantStatus | undefined, newStatus: ParticipantStatus, onFinish: () => void) {
  const dispatch = useAppDispatch();

  const participantId = 'participantId' in user ? user.participantId : user.id;

  const resolver: Resolver<FormValues> = async (values) => {
    const result: ResolverResult<FormValues> = {
      values: values ? values : {},
      errors: {},
    };

    if (values.miles != null && values.miles < 0) {
      result.errors.miles = {
        type: 'min',
        message: 'Must be a positive number',
      };
    }

    if (!values.statusTime) {
      result.errors.statusTime = {
        type: 'required',
        message: 'Status time is required',
      };
    }

    const lastStatusChangeTime = participant?.timeline[0].time;
    if (lastStatusChangeTime && !isNaN(lastStatusChangeTime) && values.statusTime < lastStatusChangeTime) {
      result.errors.statusTime = {
        type: 'min',
        message: 'Cannot be earlier than previous status change at ' + formatTime(lastStatusChangeTime),
      };
    }

    return result;
  };

  const form = useForm<FormValues>({
    resolver,
    defaultValues: { miles: participant?.miles ?? '', statusTime: new Date().getTime() },
  });

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    const time = new Date(data.statusTime).getTime();
    // The ETA form returns a string when the user sets a date manually; a number when the date is set via the preset buttons; and null when cleared. Normalize to undefined when not set, and number when set.
    const etaValue: number | undefined = data.eta == null ? undefined : typeof data.eta === 'number' ? data.eta : new Date(data.eta as unknown as string).getTime();

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
    dispatch(ActivityActions.participantUpdate(activity.id, participantId, user.given_name ?? '', user.family_name ?? '', respondingOrg.id, time, newStatus, data.miles === '' ? undefined : data.miles, etaValue));
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

export const StatusTimeInput = ({ form: { control, errors } }: { form: FormLogic }) => {
  return (
    <Controller
      name="statusTime"
      control={control}
      render={({ field }) => (
        <FormControl error={!!errors.statusTime?.message}>
          <DateTimePicker
            label="Status Time"
            value={field.value}
            inputRef={field.ref}
            onChange={(date) => {
              field.onChange(date);
            }}
            onAccept={(date) => {
              field.onChange(date);
            }}
            format="MM/dd HH:mm"
          />
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

      // Set fields with dynamic default values.
      form.setValue('miles', participant?.miles ?? '');
      form.setValue('statusTime', new Date().getTime());
    }
  }, [isInitialized, form, participant?.miles]);

  return (
    <Stack flexGrow={1} spacing={2} justifyContent="space-between">
      <DialogContentText id="status-update-dialog-description">Change your status for {activity.title}?</DialogContentText>
      <StatusTimeInput form={form} />
      {isEnrouteOrStandby(newStatus) ? <EtaInput form={form} /> : undefined}
      {newStatus === ParticipantStatus.SignedOut ? (
        <Controller
          name="miles"
          control={form.control}
          render={({ field }) => (
            <FormControl error={!!form.errors.miles?.message}>
              <ParticipantMilesInput
                value={field.value}
                currentMiles={participant?.miles ?? 0}
                onChange={(miles) => {
                  field.onChange(miles);
                }}
              />
              <FormHelperText>{form.errors.miles?.message}</FormHelperText>
            </FormControl>
          )}
        />
      ) : undefined}
    </Stack>
  );
};

const EtaInput = ({ form: { control, errors } }: { form: FormLogic }) => {
  const toMilliseconds = (minutes: number) => minutes * 60 * 1000;
  const { etaPreset1, etaPreset2, etaPreset3 } = usePreferences();
  return (
    <Controller
      name="eta"
      control={control}
      render={({ field }) => (
        <FormControl error={!!errors.eta?.message}>
          <DateTimePicker
            label="ETA"
            value={field.value}
            inputRef={field.ref}
            onChange={(date) => {
              field.onChange(date);
            }}
            onAccept={(date) => {
              field.onChange(date);
            }}
            format="MM/dd HH:mm"
            slotProps={{
              textField: {
                InputProps: field.value
                  ? {
                      endAdornment: (
                        <Stack direction={'row'} spacing={1} alignItems={'center'} justifyContent={'end'} fontSize={8} marginRight={-1.5}>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              field.onChange(null);
                            }}
                          >
                            <CloseIcon />
                          </IconButton>
                        </Stack>
                      ),
                    }
                  : undefined,
              },
            }}
          />
          <>
            <Stack direction={'row'} spacing={1} alignItems={'center'} justifyContent={'end'} fontSize={8}>
              <IconButton onClick={() => field.onChange(new Date().getTime() + toMilliseconds(etaPreset1))}>{etaPreset1}</IconButton>
              <IconButton onClick={() => field.onChange(new Date().getTime() + toMilliseconds(etaPreset2))}>{etaPreset2}</IconButton>
              <IconButton onClick={() => field.onChange(new Date().getTime() + toMilliseconds(etaPreset3))}>{etaPreset3}</IconButton>
            </Stack>
          </>
          <FormHelperText>{errors.eta?.message}</FormHelperText>
        </FormControl>
      )}
    />
  );
};
