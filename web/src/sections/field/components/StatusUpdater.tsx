import CloseIcon from '@mui/icons-material/Close';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, FormHelperText, IconButton, Stack } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { useState } from 'react';
import { statusStepsUnder, type ParticipantStatus, type StatusStep } from '@sync/domain';
import type { FieldActivity, UnitRef } from '@sync/model';
import { observer } from '@sync/model/react';
import { useHomeUnit } from '../../../shell/App';
import { personName, useAuth } from '../../../shell/auth';
import { usePreferences } from '../../../shell/preferences';
import { ParticipantMilesInput } from '../../../ui/ParticipantMilesInput';
import { SplitButton } from '../../../ui/SplitButton';
import { stepText } from '../../../ui/status';
import { formatTime } from '../../../ui/timeFormat';
import { useChange } from '../../../ui/useChange';

type SettableStatus = Exclude<ParticipantStatus, 'unknown'>;
const stepId = (s: StatusStep) => `${s.status}:${s.switchingFrom ?? ''}`;

/** Who a status button is for: their person ref, and their name should they need adding. */
export interface StatusPerson {
  personRef: string;
  firstname: string;
  lastname: string;
}

/**
 * A status button: the signed-in person's under their own unit, or, as Add Responder uses it,
 * someone else's (`person`) under the unit they're responding with (`unit`).
 */
export const StatusUpdater = observer(function StatusUpdater({ activity, fullWidth, person: given, unit: givenUnit }: { activity: FieldActivity; fullWidth?: boolean; person?: StatusPerson; unit?: UnitRef }) {
  const { session } = useAuth();
  const homeUnit = useHomeUnit();
  const unit = givenUnit ?? homeUnit;
  const [confirming, setConfirming] = useState<StatusStep | null>(null);
  const person = given ?? (session?.personRef ? { personRef: session.personRef, ...personName(session) } : undefined);
  if (!person || !activity.record) return null;

  const me = activity.participantByRef(person.personRef);
  const steps = me ? me.statusStepsUnder(unit.id) : statusStepsUnder(activity.record, undefined, unit.id, activity.clock.now());
  if (!steps.length) return null;
  const from = me?.status ?? 'unknown';
  const unitName = (id: string) => activity.unit(id)?.name ?? id;
  const options = steps.map((s) => ({ id: stepId(s), text: stepText(from, s, unitName) }));

  return (
    <>
      <SplitButton options={options} selected={options[0]!.id} fullWidth={fullWidth} onClick={(id) => setConfirming(steps.find((s) => stepId(s) === id) ?? null)} />
      <Dialog open={!!confirming} onClose={() => setConfirming(null)} aria-labelledby="status-update-dialog-title" aria-describedby="status-update-dialog-description">
        {/* Mounted only while open, so the form starts fresh each time. */}
        {confirming && (
          <UpdateStatusForm
            activity={activity}
            person={person}
            self={person.personRef === session?.personRef}
            unit={unit}
            step={confirming}
            label={stepText(from, confirming, unitName)}
            onClose={() => setConfirming(null)}
          />
        )}
      </Dialog>
    </>
  );
});

interface FormError {
  severity: 'warning' | 'error';
  text: string;
}

const UpdateStatusForm = observer(function UpdateStatusForm({
  activity,
  person,
  self,
  unit,
  step,
  label,
  onClose,
}: {
  activity: FieldActivity;
  person: StatusPerson;
  /** Whether it's the signed-in person's own status. */
  self: boolean;
  unit: UnitRef;
  step: StatusStep;
  label: string;
  onClose: () => void;
}) {
  const change = useChange();
  const me = activity.participantByRef(person.personRef);
  const status = step.status as SettableStatus;
  const currentMiles = me?.record?.miles ?? 0;
  const [statusTime, setStatusTime] = useState<number>(() => activity.clock.now());
  const [eta, setEta] = useState<number | undefined>(me?.record?.eta ?? undefined);
  const [miles, setMiles] = useState<number | ''>('');

  const showEta = status === 'standby' || status === 'responding';
  const showMiles = status === 'clear';
  const isMission = activity.record?.kind === 'mission';

  const top: FormError[] = [];
  if (me?.status === 'assigned') {
    top.push({
      severity: 'warning',
      text: `${self ? 'You are' : `${person.firstname} is`} currently assigned to a Team or Place on the Operations Dashboard. Changing ${self ? 'your' : 'their'} status may cause a discrepancy.`,
    });
  }
  if (!activity.unit(unit.id)) {
    const name = unit.rosterName ?? unit.title;
    top.push({ severity: 'warning', text: `You are the first responder for ${name}. Make sure you are authorized to commit ${name} to this ${isMission ? 'mission' : 'event'}.` });
  }
  let timeError: FormError | undefined;
  const lastChange = me?.currentStatus?.at;
  if (!statusTime) timeError = { severity: 'error', text: 'Status time is required' };
  else if (lastChange && statusTime < lastChange) timeError = { severity: 'error', text: 'Cannot be earlier than previous status change at ' + formatTime(lastChange) };
  const milesError: FormError | undefined = miles !== '' && miles < 0 ? { severity: 'error', text: 'Must be a positive number' } : undefined;

  const submit = () => {
    if (timeError || milesError) return;
    const done = change(() => {
      const at = statusTime;
      const p = me ?? activity.addParticipant(person, unit, status, { at });
      if (me) p.setStatus(status, { at, unit });
      if (showMiles && miles !== '' && miles !== currentMiles) p.setMiles(miles);
      if (showEta && eta !== (p.record?.eta ?? undefined)) p.setEta(eta ?? null);
    });
    if (done) onClose();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <DialogTitle id="status-update-dialog-title">Update Status</DialogTitle>
      <DialogContent>
        <>
          {top.map((err) => (
            <Alert key={err.text} sx={{ mb: 1 }} severity={err.severity}>
              {err.text}
            </Alert>
          ))}
          <Stack spacing={2} sx={{ flexGrow: 1, justifyContent: 'space-between' }}>
            <DialogContentText id="status-update-dialog-description">Change {self ? 'your' : `${person.firstname}'s`} status for {activity.record?.title}?</DialogContentText>
            <FormControl error={!!timeError}>
              <DateTimePicker
                label="Status Time"
                value={statusTime ? new Date(statusTime) : null}
                onChange={(date) => setStatusTime(date ? date.getTime() : 0)}
                onAccept={(date) => setStatusTime(date ? date.getTime() : 0)}
                format="MM/dd HH:mm"
              />
              <FormHelperText>{timeError?.text}</FormHelperText>
            </FormControl>
            {showEta && <EtaInput eta={eta} setEta={setEta} now={() => activity.clock.now()} />}
            {showMiles && (
              <FormControl error={!!milesError}>
                <ParticipantMilesInput value={miles} currentMiles={currentMiles} onChange={(m) => setMiles(m === '' ? '' : Number(m))} />
                <FormHelperText>{milesError?.text}</FormHelperText>
              </FormControl>
            )}
          </Stack>
        </>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" autoFocus>
          {label}
        </Button>
      </DialogActions>
    </form>
  );
});

function EtaInput({ eta, setEta, now }: { eta: number | undefined; setEta: (eta: number | undefined) => void; now: () => number }) {
  const toMilliseconds = (minutes: number) => minutes * 60 * 1000;
  const { etaPreset1, etaPreset2, etaPreset3 } = usePreferences();
  return (
    <FormControl>
      <DateTimePicker
        label="ETA"
        value={eta ? new Date(eta) : null}
        onChange={(date) => setEta(date ? date.getTime() : undefined)}
        onAccept={(date) => setEta(date ? date.getTime() : undefined)}
        format="MM/dd HH:mm"
        slotProps={{
          textField: {
            slotProps: {
              input: eta
                ? {
                    endAdornment: (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'end', fontSize: 8, marginRight: -1.5 }}>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            setEta(undefined);
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
        <IconButton onClick={() => setEta(now() + toMilliseconds(etaPreset1))}>{etaPreset1}</IconButton>
        <IconButton onClick={() => setEta(now() + toMilliseconds(etaPreset2))}>{etaPreset2}</IconButton>
        <IconButton onClick={() => setEta(now() + toMilliseconds(etaPreset3))}>{etaPreset3}</IconButton>
      </Stack>
    </FormControl>
  );
}
