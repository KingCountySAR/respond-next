import { Box, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector } from '@respond/lib/client/store/activities';
import { Participant, ParticipantStatus } from '@respond/types/activity';

export function RosterEdit({ activityId }: { activityId: string }) {
  const activity = useAppSelector(buildActivitySelector(activityId));
  const rosterEntries: Array<RosterEntry> = [];

  function getRosterEntry(participant: Participant): RosterEntry {
    const filter = (entry: RosterEntry) => entry.participantId === participant.id && !entry.timestamps[RosterStage.SignOut];
    if (!rosterEntries.some(filter)) {
      // This participant does not have an active roster entry.
      rosterEntries.unshift(new RosterEntry(participant));
    }
    return rosterEntries.find(filter)!;
  }

  function buildRosterEntries(participant: Participant) {
    for (let i = participant.timeline.length - 1; i >= 0; i--) {
      const stage: RosterStage = rosterStages[participant.timeline[i].status] ?? undefined;
      if (!stage) continue; // The participant status is not relavent to the roster.
      const rosterEntry = getRosterEntry(participant);
      if (rosterEntry.timestamps[stage]) continue; // The roster stage was already reached in a prior status update.
      rosterEntry.timestamps[stage] = participant.timeline[i].time;
    }
  }

  Object.values(activity?.participants ?? {}).forEach((participant: Participant) => {
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
              <TableCell sx={{ fontWeight: 700, width: 20 }}>Particpant Name</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 20 }}>Sign In</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 20 }}>Arrive Base</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 20 }}>Depart Base</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 20 }}>Sign Out</TableCell>
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

function RosterRow({ rosterEntry }: { rosterEntry: RosterEntry }) {
  return (
    <TableRow>
      <TableCell size="small">{rosterEntry.participantName}</TableCell>
      <TableCell size="small">{<RosterTime time={rosterEntry.timestamps[RosterStage.SignIn]} />}</TableCell>
      <TableCell size="small">{<RosterTime time={rosterEntry.timestamps[RosterStage.ArriveBase]} />}</TableCell>
      <TableCell size="small">{<RosterTime time={rosterEntry.timestamps[RosterStage.DepartBase]} />}</TableCell>
      <TableCell size="small">{<RosterTime time={rosterEntry.timestamps[RosterStage.SignOut]} />}</TableCell>
    </TableRow>
  );
}

function RosterTime({ time }: { time: number }) {
  const dateString = new Date(time).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  const timeString = new Date(time).toLocaleString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(':', '');
  return (
    <Stack>
      {!!time && (
        <>
          <Typography variant="h6">{timeString}</Typography>
          <Typography variant="caption">{dateString}</Typography>
        </>
      )}
    </Stack>
  );
}

enum RosterStage {
  NA = 0,
  SignIn = 1,
  ArriveBase = 2,
  DepartBase = 3,
  SignOut = 4,
}

interface IRosterEntry {
  participant: Participant;
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

class RosterEntry implements IRosterEntry {
  participant;
  timestamps;
  miles;
  constructor(participant: Participant) {
    this.participant = participant;
    this.timestamps = {
      [RosterStage.SignIn]: 0,
      [RosterStage.ArriveBase]: 0,
      [RosterStage.DepartBase]: 0,
      [RosterStage.SignOut]: 0,
    };
    this.miles = 0;
  }
  get participantId(): string {
    return this.participant.id;
  }
  get participantName(): string {
    return `${this.participant.firstname} ${this.participant.lastname}`;
  }
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
