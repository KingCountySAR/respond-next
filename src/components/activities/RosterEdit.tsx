import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

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
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Particpant Name</TableCell>
            <TableCell>Sign In</TableCell>
            <TableCell>Arrive Base</TableCell>
            <TableCell>Depart Base</TableCell>
            <TableCell>Sign Out</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rosterEntries.map((entry, i) => (
            <RosterRow key={i} rosterEntry={entry} />
          ))}
        </TableBody>
      </Table>
    </ToolbarPage>
  );
}

function RosterRow({ rosterEntry }: { rosterEntry: RosterEntry }) {
  return (
    <TableRow>
      <TableCell>{rosterEntry.participantName}</TableCell>
      <TableCell>{!!rosterEntry.timestamps[RosterStage.SignIn] && formatTime(rosterEntry.timestamps[RosterStage.SignIn])}</TableCell>
      <TableCell>{!!rosterEntry.timestamps[RosterStage.ArriveBase] && formatTime(rosterEntry.timestamps[RosterStage.ArriveBase])}</TableCell>
      <TableCell>{!!rosterEntry.timestamps[RosterStage.DepartBase] && formatTime(rosterEntry.timestamps[RosterStage.DepartBase])}</TableCell>
      <TableCell>{!!rosterEntry.timestamps[RosterStage.SignOut] && formatTime(rosterEntry.timestamps[RosterStage.SignOut])}</TableCell>
    </TableRow>
  );
}

function formatTime(time: number) {
  if (!time) {
    return '';
  }
  return new Date(time).toLocaleString('en-US', { hour12: false });
}

enum RosterStage {
  NA = 0,
  SignIn = 1,
  ArriveBase = 2,
  DepartBase = 3,
  SignOut = 4,
}

interface IRosterEntry {
  participantId: string;
  participantName: string;
  timestamps: {
    [RosterStage.SignIn]: number;
    [RosterStage.ArriveBase]: number;
    [RosterStage.DepartBase]: number;
    [RosterStage.SignOut]: number;
  };
}

class RosterEntry implements IRosterEntry {
  participantId;
  participantName;
  timestamps;
  constructor(participant: Participant) {
    this.participantId = participant.id;
    this.participantName = `${participant.firstname} ${participant.lastname}`;
    this.timestamps = {
      [RosterStage.SignIn]: 0,
      [RosterStage.ArriveBase]: 0,
      [RosterStage.DepartBase]: 0,
      [RosterStage.SignOut]: 0,
    };
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
