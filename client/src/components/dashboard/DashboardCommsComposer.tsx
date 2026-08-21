import { Autocomplete, Box, Button, Stack, TextField } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { useEffect, useMemo, useRef } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import { useCommsCommands } from '@respond/lib/client/services/comms';
import { CommunicationsLogEntry } from '@respond/shared/types/operations';

import { useActivityContext } from '../activities/ActivityProvider';

const PREDEFINED_COMMS_CONTACTS = ['All Teams', 'Incident Commander'];

type FormValues = {
  from: string;
  to: string;
  message: string;
  timestamp: number;
};

type DashboardCommsComposerProps = {
  entry?: CommunicationsLogEntry | null;
  onSave?: () => void;
  onCancel?: () => void;
};

// MUI's default renderOption spreads a "key" prop into <li>; pull it out and pass it directly to silence React's key-spread warning.
function renderContactOption(props: React.HTMLAttributes<HTMLLIElement> & { key?: React.Key }, option: string) {
  const { key, ...optionProps } = props;
  return (
    <li key={key} {...optionProps}>
      {option}
    </li>
  );
}

export function DashboardCommsComposer({ entry, onSave, onCancel }: DashboardCommsComposerProps) {
  const comms = useCommsCommands();
  const activity = useActivityContext();
  const fromRef = useRef<HTMLInputElement | null>(null);

  // Split by source so adding a comms entry only re-scans comms, not teams/staff/places.
  const teamContacts = useMemo(() => (activity.teams ?? []).filter((team) => team.status !== 'Disbanded').map((team) => team.name), [activity.teams]);
  const staffContacts = useMemo(() => Object.keys(activity.staff ?? {}), [activity.staff]);
  const placeContacts = useMemo(() => (activity.places ?? []).map((place) => place.name), [activity.places]);
  const commsContacts = useMemo(() => {
    const seen = new Set<string>();
    (activity.comms ?? []).forEach((comm) => {
      if (comm.from) seen.add(comm.from);
      if (comm.to) seen.add(comm.to);
    });
    return Array.from(seen);
  }, [activity.comms]);

  const contactOptions = useMemo(() => {
    const options = new Set<string>([...PREDEFINED_COMMS_CONTACTS, ...teamContacts, ...staffContacts, ...placeContacts, ...commsContacts]);
    return Array.from(options).sort((left, right) => left.localeCompare(right));
  }, [teamContacts, staffContacts, placeContacts, commsContacts]);

  const { register, handleSubmit, reset, formState, control } = useForm<FormValues>({
    defaultValues: {
      from: entry?.from ?? '',
      to: entry?.to ?? '',
      message: entry?.message ?? '',
      timestamp: entry?.timestamp ?? Date.now(),
    },
  });

  useEffect(() => {
    if (!entry) {
      fromRef.current?.focus();
    }
  }, [entry]);

  const submit: SubmitHandler<FormValues> = (values) => {
    if (entry && entry.id) {
      const updates: Partial<CommunicationsLogEntry> = {
        from: values.from,
        to: values.to,
        message: values.message,
        timestamp: values.timestamp,
        isAutomated: false, // Automated messages are toggled to false when edited
      };
      comms.updateComm(activity.id, entry.id, updates);
      onSave?.();
    } else {
      // No id/timestamp — the server stamps those when it mints CommLogged.
      comms.logComm(activity.id, { from: values.from, to: values.to, message: values.message });
      onSave?.();
    }

    reset({ from: '', to: '', message: '', timestamp: Date.now() });

    if (!entry) {
      fromRef.current?.focus();
    }
  };

  return (
    <Box sx={{ borderColor: 'divider', p: 0.5, mt: entry ? 0 : 0.5, flexShrink: 0 }}>
      <form onSubmit={handleSubmit(submit)}>
        <Stack spacing={1}>
          <Stack direction={{ xl: 'row' }} spacing={2} sx={{ alignItems: { xs: 'stretch', xl: 'center' } }}>
            <Controller
              name="from"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={contactOptions}
                  inputValue={field.value}
                  onInputChange={(_, newInputValue) => field.onChange(newInputValue)}
                  renderOption={renderContactOption}
                  renderInput={(params) => <TextField {...params} label="From" size="small" inputRef={fromRef} />}
                  sx={{ flex: entry ? 1 : undefined, minWidth: 0 }}
                />
              )}
            />
            <Controller
              name="to"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={contactOptions}
                  inputValue={field.value}
                  onInputChange={(_, newInputValue) => field.onChange(newInputValue)}
                  renderOption={renderContactOption}
                  renderInput={(params) => <TextField {...params} label="To" size="small" />}
                  sx={{ flex: entry ? 1 : undefined, minWidth: 0 }}
                />
              )}
            />
            {entry && (
              <Controller
                name="timestamp"
                control={control}
                render={({ field }) => (
                  <DateTimePicker
                    label="Time"
                    value={new Date(field.value)}
                    format="MM/dd/yyyy HH:mm"
                    onChange={(newValue) => {
                      if (newValue) {
                        field.onChange(newValue.getTime());
                      }
                    }}
                    slotProps={{ textField: { size: 'small' } }}
                    sx={{ flex: 1, minWidth: 0 }}
                  />
                )}
              />
            )}
          </Stack>
          <TextField
            label="Message"
            size="small"
            multiline
            minRows={2}
            {...register('message', { required: true })}
            error={!!formState.errors.message}
            helperText={formState.errors.message ? 'Message is required' : ''}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(submit)();
              }
            }}
          />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {entry && (
                <Button
                  onClick={() => {
                    reset();
                    onCancel?.();
                  }}
                  size="small"
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" size="small" variant="contained">
                Save
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </form>
    </Box>
  );
}
