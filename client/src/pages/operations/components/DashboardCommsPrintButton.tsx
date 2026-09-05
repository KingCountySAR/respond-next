import PrintIcon from '@mui/icons-material/Print';
import { Box, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

import { Activity } from '@respond/shared/types/activity';
import { CommunicationsLogEntry } from '@respond/shared/types/operations';

// TODO: This function exists in multiple places, consider moving it to a shared utility file
function format24HourTime(value: number) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
}

export function DashboardCommsPrintButton({ activity, communications }: { activity: Activity; communications: Array<CommunicationsLogEntry> }): JSX.Element {
  const printable = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => printable.current,
    documentTitle: `${activity.title || 'activity'}-comms-log`,
  });

  return (
    <>
      <Tooltip title={'Print communications log'}>
        <IconButton
          onClick={handlePrint}
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <PrintIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Box ref={printable} sx={{ display: 'none', '@media print': { display: 'block' } }}>
        <DashboardCommsPrintView activity={activity} communications={communications} />
      </Box>
    </>
  );
}

function DashboardCommsPrintView({ activity, communications }: { activity: Activity | undefined; communications: Array<CommunicationsLogEntry> }) {
  const { title, startTime, endTime, idNumber } = activity || {};
  const startTimeValue = startTime ? new Date(startTime) : undefined;
  const endTimeValue = endTime ? new Date(endTime) : undefined;
  const generatedAt = new Date();
  const ids = communications.map((c) => c.id);
  const bad = ids.filter((id, i) => !id || ids.indexOf(id) !== i);
  if (bad.length) {
    console.warn('Comms key issue', { bad, ids, communications });
  }
  return (
    <Box sx={{ p: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell colSpan={4}>
              <Stack direction="row" sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Stack>
                  <Typography variant="body2">{title}</Typography>
                  <Typography variant="body2">State #: {idNumber ?? '_____________'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Communications Log
                  </Typography>
                </Stack>
                <Stack sx={{ alignItems: 'flex-end' }}>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
                    Start Time: {startTimeValue ? `${startTimeValue.toLocaleDateString('en-US')} ${format24HourTime(startTimeValue.getTime())}` : '_____________'}
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
                    End Time: {endTimeValue ? `${endTimeValue.toLocaleDateString('en-US')} ${format24HourTime(endTimeValue.getTime())}` : '_____________'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Printed: {generatedAt.toLocaleDateString('en-US')} {format24HourTime(generatedAt.getTime())}
                  </Typography>
                </Stack>
              </Stack>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, width: 80 }}>Time</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 120 }}>From</TableCell>
            <TableCell sx={{ fontWeight: 700, width: 120 }}>To</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Message</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {communications.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{format24HourTime(entry.timestamp)}</TableCell>
              <TableCell>{entry.from}</TableCell>
              <TableCell>{entry.to}</TableCell>
              <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{entry.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
