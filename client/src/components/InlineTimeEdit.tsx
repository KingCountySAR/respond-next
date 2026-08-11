import { Close } from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { DateOrTimeView } from '@mui/x-date-pickers/models';

import { IconButton, Stack } from './Material';

export function InlineTimeEdit({ label, format, openTo, onChange, onClose }: { label: string; format: string; openTo: DateOrTimeView | undefined; onChange: (time: number | null) => void; onClose: () => void }) {
  return (
    <Stack direction="row" sx={{ flexGrow: 1, justifyContent: 'space-between' }}>
      <DateTimePicker value={new Date()} label={label} format={format} onAccept={(d) => onChange(d ? d.getTime() : null)} onClose={onClose} openTo={openTo} />
      <IconButton disableRipple onClick={onClose}>
        <Close />
      </IconButton>
    </Stack>
  );
}
