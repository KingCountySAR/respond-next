import CloseIcon from '@mui/icons-material/Close';
import { DateTimePicker } from '@mui/x-date-pickers';
import { observer } from 'mobx-react-lite';

import { usePreferences } from '@respond/components/PreferencesProvider';

import { Alert, Button, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, FormHelperText, IconButton, Stack } from '../Material';
import { ParticipantMilesInput } from '../participant/ParticipantMilesInput';

import { StatusUpdateFormModel } from './statusUpdateFormModel';
import { StatusUpdaterViewModel } from './statusUpdaterViewModel';

/**
 * The confirmation dialog body: title, warnings, the status-change form, and the
 * confirm/cancel actions. Presentational only — all field state, validation, and
 * submit live on {@link StatusUpdaterViewModel.form}; the inputs bind straight to it.
 */
export const UpdateStatusForm = observer(function UpdateStatusForm({ vm }: { vm: StatusUpdaterViewModel }) {
  const { form } = vm;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.submit();
      }}
    >
      <DialogTitle id="status-update-dialog-title">{vm.confirmTitle}</DialogTitle>
      <DialogContent>
        <>
          {form.errors.top?.map((err) => (
            <Alert sx={{ mb: 1 }} severity={err.severity}>
              {err.text}
            </Alert>
          ))}
          <Stack spacing={2} sx={{ flexGrow: 1, justifyContent: 'space-between' }}>
            <DialogContentText id="status-update-dialog-description">Change your status for {vm.activityTitle}?</DialogContentText>
            <StatusTimeInput form={form} />
            {form.showEta && <EtaInput form={form} />}
            {form.showMiles && <MilesInput form={form} />}
          </Stack>
        </>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => vm.close()}>Cancel</Button>
        <Button type="submit" autoFocus>
          {vm.confirmLabel}
        </Button>
      </DialogActions>
    </form>
  );
});

const StatusTimeInput = observer(({ form }: { form: StatusUpdateFormModel }) => (
  <FormControl error={!!form.errors.statusTime}>
    <DateTimePicker
      label="Status Time"
      value={form.statusTime ? new Date(form.statusTime) : null}
      onChange={(date) => form.setStatusTime(date ? date.getTime() : null)}
      onAccept={(date) => form.setStatusTime(date ? date.getTime() : null)}
      format="MM/dd HH:mm"
    />
    <FormHelperText>{form.errors.statusTime?.text}</FormHelperText>
  </FormControl>
));

const MilesInput = observer(({ form }: { form: StatusUpdateFormModel }) => (
  <FormControl error={!!form.errors.miles}>
    <ParticipantMilesInput value={form.miles} currentMiles={form.currentMiles} onChange={(miles) => form.setMiles(miles)} />
    <FormHelperText>{form.errors.miles?.text}</FormHelperText>
  </FormControl>
));

const EtaInput = observer(({ form }: { form: StatusUpdateFormModel }) => {
  const toMilliseconds = (minutes: number) => minutes * 60 * 1000;
  const { etaPreset1, etaPreset2, etaPreset3 } = usePreferences();
  return (
    <FormControl>
      <DateTimePicker
        label="ETA"
        value={form.eta ? new Date(form.eta) : null}
        onChange={(date) => form.setEta(date ? date.getTime() : null)}
        onAccept={(date) => form.setEta(date ? date.getTime() : null)}
        format="MM/dd HH:mm"
        slotProps={{
          textField: {
            slotProps: {
              input: form.eta
                ? {
                    endAdornment: (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'end', fontSize: 8, marginRight: -1.5 }}>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            form.setEta(null);
                          }}
                        >
                          <CloseIcon />
                        </IconButton>
                      </Stack>
                    ),
                  }
                : undefined,
            },
          },
        }}
      />
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'end', fontSize: 8 }}>
        <IconButton onClick={() => form.setEta(Date.now() + toMilliseconds(etaPreset1))}>{etaPreset1}</IconButton>
        <IconButton onClick={() => form.setEta(Date.now() + toMilliseconds(etaPreset2))}>{etaPreset2}</IconButton>
        <IconButton onClick={() => form.setEta(Date.now() + toMilliseconds(etaPreset3))}>{etaPreset3}</IconButton>
      </Stack>
    </FormControl>
  );
});
