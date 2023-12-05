import { Box, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector } from '@respond/lib/client/store/activities';
import { Participant, ParticipantStatus, ParticipantUpdate } from '@respond/types/activity';

const headerCellStyle = { fontWeight: 700, width: 20 };

export function RosterView({ activityId }: { activityId: string }) {
  const activity = useAppSelector(buildActivitySelector(activityId));

  if (!activity) {
    return <ActivityNotFound />;
  }

  const rosterEntries: Array<RosterEntry> = [];

  const buildRosterEntries = (participant: Participant) => {
    const timeline: Array<ParticipantUpdate> = scrubTimeline(participant.timeline);
    for (let i = timeline.length - 1; i >= 0; i--) {
      const stage: RosterStage = rosterStages[timeline[i].status] ?? undefined;
      if (!stage) continue; // The participant status is not relavent to the roster.
      const rosterEntry = getRosterEntry(participant);
      rosterEntry.timestamps[stage] = timeline[i].time;
    }
  };

  const getRosterEntry = (participant: Participant): RosterEntry => {
    return findRosterEntry(participant) ?? createRosterEntry(participant);
  };

  const createRosterEntry = (participant: Participant) => {
    const newEntry = buildRosterEntry(participant);
    rosterEntries.unshift(newEntry);
    return newEntry;
  };

  const findRosterEntry = (participant: Participant) => {
    return rosterEntries.find((entry) => entry.participantId === participant.id && !isComplete(entry));
  };

  Object.values(activity.participants ?? {}).forEach((participant: Participant) => {
    buildRosterEntries(participant);
  });

  return (
    <ToolbarPage maxWidth="lg">
      <Paper>
        <Box padding={2}>
          <Typography variant="h4">
            {activity?.idNumber} {activity?.title}
          </Typography>
        </Box>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={headerCellStyle}>Particpant Name</TableCell>
              <TableCell align="center" sx={headerCellStyle}>
                Sign In
              </TableCell>
              <TableCell align="center" sx={headerCellStyle}>
                Arrive Base
              </TableCell>
              <TableCell align="center" sx={headerCellStyle}>
                Depart Base
              </TableCell>
              <TableCell align="center" sx={headerCellStyle}>
                Sign Out
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rosterEntries.map((entry, i) => (
              <RosterRow key={i} rosterEntry={entry} />
            ))}
          </TableBody>
        </Table>
      </Paper>
    </ToolbarPage>
  );
}

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

function RosterRow({ rosterEntry }: { rosterEntry: RosterEntry }) {
  return (
    <TableRow>
      <TableCell size="small">{rosterEntry.participantName}</TableCell>
      {Object.values(rosterEntry.timestamps).map((time, i) => (
        <TableCell key={i} align="center" size="small">
          <Stack>{time ? <RosterTimeValue time={time} /> : undefined}</Stack>
        </TableCell>
      ))}
    </TableRow>
  );
}

function RosterTimeValue({ time }: { time: number }) {
  const dateString = new Date(time).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  const timeString = new Date(time).toLocaleString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(':', '');
  return (
    <>
      <Typography variant="h6">{timeString}</Typography>
      <Typography variant="caption">{dateString}</Typography>
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

const buildRosterEntry = (participant: Participant): RosterEntry => {
  return {
    participantId: participant.id,
    participantName: `${participant.firstname} ${participant.lastname}`,
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