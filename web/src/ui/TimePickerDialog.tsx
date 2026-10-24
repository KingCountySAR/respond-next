import { MobileDateTimePicker, renderMultiSectionDigitalClockTimeView } from '@mui/x-date-pickers';
import { useEffect, useState } from 'react';

/**
 * A date and time picked in a dialog, for a time shown elsewhere (as respond-next's timeline and ETA
 * do): hours first, hours and minutes as lists, any minute. What's picked is kept here while the
 * dialog is open (a controlled picker needs it) and passed on once, on OK.
 */
export function TimePickerDialog({ open, value, label, onAccept, onClose }: { open: boolean; value: number; label: string; onAccept: (time: number) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<Date | null>(new Date(value));
  useEffect(() => {
    if (open) setPicked(new Date(value));
  }, [open, value]);

  return (
    <MobileDateTimePicker
      open={open}
      value={picked}
      label={label}
      format="MM/dd HH:mm"
      openTo="hours"
      timeSteps={{ minutes: 1 }}
      viewRenderers={{ hours: renderMultiSectionDigitalClockTimeView, minutes: renderMultiSectionDigitalClockTimeView }}
      onChange={setPicked}
      onAccept={(d) => {
        if (d && !Number.isNaN(d.getTime())) onAccept(d.getTime());
      }}
      onClose={onClose}
      slots={{ field: () => null }}
    />
  );
}
