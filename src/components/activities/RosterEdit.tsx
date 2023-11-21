import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector } from '@respond/lib/client/store/activities';
import { Participant, ParticipantStatus, ParticipantUpdate } from '@respond/types/activity';

export function RosterEdit({ activityId }: { activityId: string }) {
  const activity = useAppSelector(buildActivitySelector(activityId));
  const rosterEntries: Array<RosterEntry> = [];

  Object.entries(activity?.participants ?? {}).forEach(([participantId, participant]: [participantId: string, participant: Participant]) => {
    for (let i = participant.timeline.length - 1; i >= 0; i--) {
      const update: ParticipantUpdate = participant.timeline[i];
      const stage: RosterStage = rosterStages[update.status] ?? undefined;
      if (!stage) {
        // The participant status is not relavent to the roster.
        continue;
      }
      if (!rosterEntries.some((f) => f.participant.id === participantId && !f.timestamps[RosterStage.SignOut])) {
        // This participant does not have an active roster entry.
        rosterEntries.unshift(new RosterEntry(participant));
      }
      const rosterEntry = rosterEntries.find((f) => f.participant.id === participantId && !f.timestamps[RosterStage.SignOut]);
      if (rosterEntry!.timestamps[stage]) {
        // The roster stage was already reached in a prior status update.
        continue;
      }
      rosterEntry!.timestamps[stage] = update.time;
    }
  });

  return (
    <ToolbarPage maxWidth="lg">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Participant Id</TableCell>
            <TableCell>Particpant Name</TableCell>
            <TableCell>Sign In</TableCell>
            <TableCell>Arrive Base</TableCell>
            <TableCell>Depart Base</TableCell>
            <TableCell>Sign Out</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{!!rosterEntries && rosterEntries.map((m, i) => <RosterRow key={i} rosterEntry={m} />)}</TableBody>
      </Table>
    </ToolbarPage>
  );
}

function RosterRow({ rosterEntry }: { rosterEntry: RosterEntry }) {
  return (
    <TableRow>
      <TableCell>{rosterEntry.participant.id}</TableCell>
      <TableCell>{`${rosterEntry.participant.firstname} ${rosterEntry.participant.lastname}`}</TableCell>
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
  participant: Partial<Participant>;
  timestamps: {
    [RosterStage.SignIn]: number;
    [RosterStage.ArriveBase]: number;
    [RosterStage.DepartBase]: number;
    [RosterStage.SignOut]: number;
  };
}

class RosterEntry implements IRosterEntry {
  participant: Partial<Participant>;
  timestamps;
  constructor(participant: Participant) {
    this.participant = { id: participant.id, firstname: participant.firstname, lastname: participant.lastname };
    this.timestamps = {
      [RosterStage.SignIn]: 0,
      [RosterStage.ArriveBase]: 0,
      [RosterStage.DepartBase]: 0,
      [RosterStage.SignOut]: 0,
    };
  }
  get name() {
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
