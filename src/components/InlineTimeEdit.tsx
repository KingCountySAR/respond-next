import { Close } from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { DateOrTimeViewWithMeridiem } from '@mui/x-date-pickers/internals/models';

import { IconButton, Stack } from './Material';

export function InlineTimeEdit({ label, format, openTo, onChange, onClose }: { label: string; format: string; openTo: DateOrTimeViewWithMeridiem | undefined; onChange: (time: number | null) => void; onClose: () => void }) {
  return (
    <Stack flexGrow={1} direction="row" justifyContent="space-between">
      <DateTimePicker value={new Date().getTime()} label={label} format={format} onAccept={onChange} onClose={onClose} openTo={openTo} />
      <IconButton disableRipple onClick={onClose}>
        <Close />
      </IconButton>
    </Stack>
  );
}
