import { Box, Button, Divider, FormControlLabel, FormGroup, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { tableCellClasses } from '@mui/material/TableCell';
import { differenceInCalendarDays, format as formatDate } from 'date-fns';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import type { FieldActivity } from '@sync/model';
import { observer, useFieldActivity } from '@sync/model/react';
import { ActivityLayout } from '../../shell/ActivityLayout';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { OutputForm, OutputText, OutputTime } from '../../ui/OutputForm';
import { padRosterEntries, rosterCsv, rosterEntries, type RosterEntry, type RosterPerson } from './rosterEntries';

const headerCellStyle = { fontWeight: 700, width: 20 };
const rosterRowStyle = { height: 45 };
const columnBordersStyle = {
  [`& .${tableCellClasses.root}`]: {
    borderLeft: '1px solid rgba(224, 224, 224, 1)', // Adds a left border to all cells
  },
};

export function RosterReportPage({ activityId }: { activityId: string }) {
  return (
    <ActivityLayout activityId={activityId}>
      <RosterReport />
    </ActivityLayout>
  );
}

const rosterPeople = (activity: FieldActivity): RosterPerson[] =>
  activity.participants.flatMap((p) => {
    const r = p.record;
    if (!r) return [];
    return [{ id: p.id, firstname: r.firstname, lastname: r.lastname, miles: r.miles, unitId: p.unit?.id, timeline: p.timeline }];
  });

const RosterReport = observer(function RosterReport() {
  const activity = useFieldActivity();
  const [lastNameFirst, setLastNameFirst] = useState(false);
  const [showColumnBorders, setShowColumnBorders] = useState(false);
  const [showStandby, setShowStandby] = useState(false);

  useEffect(() => {
    document.title = `Roster - ${activity.record?.title ?? ''}`;
  }, [activity.record?.title]);

  const entries = rosterEntries(rosterPeople(activity), (unitId) => activity.unit(unitId)?.name ?? '', { lastNameFirst, showStandby });

  const download = () => {
    const blob = new Blob([rosterCsv(entries, (t) => formatDate(t, 'MM/dd/yy hh:mm a'))], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.setAttribute('download', 'roster.csv');
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const printable = useRef<HTMLTableElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printable });

  return (
    <ToolbarPage maxWidth="lg">
      <Stack direction="row" spacing={1} divider={<Divider orientation="vertical" flexItem />} sx={{ flex: '1 1 auto' }}>
        <Box sx={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column' }}>
          <Paper>
            <Roster ref={printable} activity={activity} entries={entries} bordered={showColumnBorders} />
          </Paper>
        </Box>
        <Stack spacing={2} sx={{ alignItems: 'stretch' }}>
          <FormGroup>
            <FormControlLabel control={<Switch />} label="Include Standby" onChange={() => setShowStandby(!showStandby)} />
            <FormControlLabel control={<Switch />} label="Show Column Borders" onChange={() => setShowColumnBorders(!showColumnBorders)} />
            <FormControlLabel control={<Switch />} label="Last Name, First, Name" onChange={() => setLastNameFirst(!lastNameFirst)} />
          </FormGroup>
          <Button variant="outlined" onClick={download}>
            Download (csv)
          </Button>
          <Button variant="outlined" onClick={() => handlePrint()}>
            Print
          </Button>
        </Stack>
      </Stack>
    </ToolbarPage>
  );
});

const Roster = observer(
  forwardRef<HTMLTableElement, { activity: FieldActivity; entries: RosterEntry[]; bordered: boolean }>(function Roster({ activity, entries, bordered }, ref) {
    const a = activity.record!;
    return (
      <Table ref={ref} size="small" sx={bordered ? columnBordersStyle : undefined}>
        <TableHead>
          <TableRow>
            <TableCell colSpan={7}>
              <OutputForm columns={2}>
                <Stack>
                  <OutputText label="Name" value={a.title}></OutputText>
                  <OutputText label="State #" value={a.idNumber}></OutputText>
                </Stack>
                <Stack>
                  <OutputTime time={a.startTime} label="Start Time"></OutputTime>
                  <OutputTime time={a.endTime ?? undefined} label="End Time"></OutputTime>
                </Stack>
              </OutputForm>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={headerCellStyle}>Particpant Name</TableCell>
            <TableCell sx={headerCellStyle}>Organization</TableCell>
            <TableCell sx={headerCellStyle}>Sign In</TableCell>
            <TableCell sx={headerCellStyle}>Arrive Base</TableCell>
            <TableCell sx={headerCellStyle}>Depart Base</TableCell>
            <TableCell sx={headerCellStyle}>Sign Out</TableCell>
            <TableCell sx={headerCellStyle}>Miles</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {padRosterEntries(entries).map((entry, i) => (
            <RosterRow key={i} entry={entry} activityStartTime={a.startTime} />
          ))}
        </TableBody>
      </Table>
    );
  }),
);

function RosterRow({ activityStartTime, entry }: { activityStartTime: number; entry: RosterEntry }) {
  return (
    <TableRow sx={rosterRowStyle}>
      <TableCell>{entry.participantName}</TableCell>
      <TableCell>{entry.organizationName}</TableCell>
      {Object.values(entry.timestamps).map((time, i) => (
        <TableCell key={i}>
          <Stack>{time ? <RosterTimeValue time={time} startTime={activityStartTime} /> : undefined}</Stack>
        </TableCell>
      ))}
      <TableCell>
        <Typography variant="h6">{entry.miles}</Typography>
      </TableCell>
    </TableRow>
  );
}

// 24-hour time, with the date under it when it's not the activity's start day.
function RosterTimeValue({ startTime, time }: { startTime: number; time: number }) {
  const dateDiff = Math.abs(differenceInCalendarDays(new Date(startTime), new Date(time)));
  const dateString = new Date(time).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  const timeString = new Date(time).toLocaleString('en-US', { hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).replace(':', '');
  return (
    <>
      <Typography variant="h6">{timeString}</Typography>
      {dateDiff ? <Typography variant="caption">{dateString}</Typography> : <></>}
    </>
  );
}
