import { Box, Button, Divider, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { differenceInCalendarDays, format as formatDate } from 'date-fns';
import { forwardRef, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector } from '@respond/lib/client/store/activities';
import { Activity, getOrganizationName, Participant, ParticipantStatus, ParticipantUpdate } from '@respond/types/activity';

import { OutputForm, OutputText, OutputTime } from '../OutputForm';

const headerCellStyle = { fontWeight: 700, width: 20 };

export function RosterReview({ activityId }: { activityId: string }) {
  const activity = useAppSelector(buildActivitySelector(activityId));
  const rosterEntries = getRosterEntries(activity);

  const download = () => {
    const data = rosterEntries.map((e) => {
      return [e.participantId, e.participantName, e.organizationName, ...Object.values(e.timestamps).map((t) => (t ? formatDate(t, 'MM/dd/yy hh:mm a') : '')), e.miles]
        .map(String) // convert every value to String
        .map((v) => v.replaceAll('"', '""')) // escape double quotes
        .map((v) => `"${v}"`) // quote it
        .join(','); // comma-separated;
    });
    data.unshift(`"participant_id","participant_name","organization_name","sign_in","arrive_base","depart_base","sign_out","miles"`);
    const blob = new Blob([data.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Create a link to download it
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.setAttribute('download', 'roster.csv');
    anchor.click();
    anchor.remove();
  };

  const printable = useRef(null);
  const handlePrint = useReactToPrint({
    content: () => printable.current,
  });

  return (
    <ToolbarPage maxWidth="lg">
      <Stack direction="row" flex="1 1 auto" spacing={1} divider={<Divider orientation="vertical" flexItem />}>
        <Box display="flex" flex="1 1 auto" flexDirection="column">
          <Paper>{activity ? <Roster ref={printable} activity={activity} rosterEntries={rosterEntries} /> : <ActivityNotFound />}</Paper>
        </Box>
        <Stack alignItems="stretch" spacing={2}>
          <Button variant="outlined" onClick={download}>
            Download (csv)
          </Button>
          <Button variant="outlined" onClick={handlePrint}>
            Print
          </Button>
        </Stack>
      </Stack>
    </ToolbarPage>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Roster = forwardRef(function Roster({ activity, rosterEntries }: { activity: Activity; rosterEntries: Array<RosterEntry> }, ref: any) {
  if (!rosterEntries.length) return <ActivityNotFound />;
  return (
    <Table ref={ref} size="small">
      <TableHead>
        <TableRow>
          <TableCell colSpan={7}>
            <OutputForm columns={2}>
              <Stack>
                <OutputText label="Name" value={activity?.title}></OutputText>
                <OutputText label="State #" value={activity?.idNumber}></OutputText>
              </Stack>
              <Stack>
                <OutputTime time={activity.startTime} label="Start Time"></OutputTime>
                <OutputTime time={activity.endTime} label="End Time"></OutputTime>
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
        {rosterEntries.map((entry, i) => (
          <RosterRow key={i} rosterEntry={entry} activityStartTime={activity.startTime} />
        ))}
      </TableBody>
    </Table>
  );
});

function ActivityNotFound() {
  return (
    <ToolbarPage maxWidth="lg">
      <Paper>
        <Box padding={2}>
          <Typography>Activity Not Found</Typography>
        </Box>
      </Paper>
    </ToolbarPage>
  );
}

function RosterRow({ activityStartTime, rosterEntry }: { activityStartTime: number; rosterEntry: RosterEntry }) {
  return (
    <TableRow>
      <TableCell>{rosterEntry.participantName}</TableCell>
      <TableCell>{rosterEntry.organizationName}</TableCell>
      {Object.values(rosterEntry.timestamps).map((time, i) => (
        <TableCell key={i}>
          <Stack>{time ? <RosterTimeValue time={time} startTime={activityStartTime} /> : undefined}</Stack>
        </TableCell>
      ))}
      <TableCell>
        <Typography variant="h6">{rosterEntry.miles}</Typography>
      </TableCell>
    </TableRow>
  );
}

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

enum RosterStage {
  NA = 0,
  SignIn = 1,
  ArriveBase = 2,
  DepartBase = 3,
  SignOut = 4,
}

const rosterStages: Record<ParticipantStatus, RosterStage> = {
  [ParticipantStatus.NotResponding]: RosterStage.NA,
  [ParticipantStatus.Standby]: RosterStage.NA,
  [ParticipantStatus.Assigned]: RosterStage.NA,
  [ParticipantStatus.SignedIn]: RosterStage.SignIn,
  [ParticipantStatus.Remote]: RosterStage.SignIn,
  [ParticipantStatus.Available]: RosterStage.ArriveBase,
  [ParticipantStatus.Demobilized]: RosterStage.DepartBase,
  [ParticipantStatus.SignedOut]: RosterStage.SignOut,
};

interface RosterEntry {
  participantId: string;
  participantName: string;
  organizationName: string;
  timestamps: {
    [RosterStage.SignIn]: number;
    [RosterStage.ArriveBase]: number;
    [RosterStage.DepartBase]: number;
    [RosterStage.SignOut]: number;
  };
  miles: number;
}

const scrubTimeline = (timeline: Array<ParticipantUpdate>): Array<ParticipantUpdate> => {
  const newTimeline = [];
  let priorStage = RosterStage.NA;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const t = timeline[i];
    const stage: RosterStage = rosterStages[t.status] ?? undefined;
    if (stage === RosterStage.NA && i === 0) {
      newTimeline.unshift(t); // Keep if latest status
      priorStage = stage;
    } else if (stage === RosterStage.SignOut) {
      newTimeline.unshift(t);
      priorStage = RosterStage.NA;
    } else if (stage === priorStage + 1) {
      newTimeline.unshift(t);
      priorStage = stage;
    }
  }
  return newTimeline;
};

const buildRosterEntry = (participant: Participant, organizationName: string): RosterEntry => {
  return {
    participantId: participant.id,
    participantName: `${participant.firstname} ${participant.lastname}`,
    organizationName: organizationName,
    timestamps: {
      [RosterStage.SignIn]: 0,
      [RosterStage.ArriveBase]: 0,
      [RosterStage.DepartBase]: 0,
      [RosterStage.SignOut]: 0,
    },
    miles: 0,
  };
};

const isComplete = (entry: RosterEntry): boolean => {
  return !!entry.timestamps[RosterStage.SignOut];
};

const getRosterEntries = (activity?: Activity) => {
  if (!activity) return [];

  const rosterEntries: Array<RosterEntry> = [];

  const buildRosterEntries = (participant: Participant) => {
    const timeline: Array<ParticipantUpdate> = scrubTimeline(participant.timeline);
    for (let i = timeline.length - 1; i >= 0; i--) {
      const stage: RosterStage = rosterStages[timeline[i].status] ?? undefined;
      if (!stage) continue; // The participant status is not relavent to the roster.
      let rosterEntry = findRosterEntry(participant);
      if (rosterEntry === undefined) {
        if (stage !== RosterStage.SignIn) {
          continue; // Skip orphaned status transitions by requiring a sign in status first.
        } else {
          rosterEntry = createRosterEntry(participant, timeline[i].organizationId);
        }
      }
      rosterEntry.timestamps[stage] = timeline[i].time;
    }
    // Miles are currently only tracked in aggregate at the participant level. For now, we only
    // want to append them to the first roster entry for this participant.
    const firstEntry = rosterEntries.reverse().find((entry) => entry.participantId === participant.id);
    if (firstEntry) {
      firstEntry.miles = participant.miles ?? 0;
    }
  };

  const createRosterEntry = (participant: Participant, organizationId: string) => {
    const org = getOrganizationName(activity, organizationId);
    const newEntry = buildRosterEntry(participant, org);
    rosterEntries.unshift(newEntry);
    return newEntry;
  };

  const findRosterEntry = (participant: Participant) => {
    return rosterEntries.find((entry) => entry.participantId === participant.id && !isComplete(entry));
  };

  Object.values(activity.participants ?? {}).forEach((participant: Participant) => {
    buildRosterEntries(participant);
  });

  return rosterEntries;
};
