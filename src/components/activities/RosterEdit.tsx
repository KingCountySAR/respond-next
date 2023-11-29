import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Dialog, DialogContent, DialogContentText, DialogTitle, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { useState } from 'react';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivitySelector } from '@respond/lib/client/store/activities';
import { Activity, Participant, ParticipantStatus, ParticipantUpdate } from '@respond/types/activity';

export function RosterEdit({ activityId }: { activityId: string }) {
  const activity = useAppSelector(buildActivitySelector(activityId));
  const roster = new Roster(activity!);
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
              <TableCell align="center" sx={{ fontWeight: 700, width: 20 }}>
                Sign In
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 20 }}>
                Arrive Base
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 20 }}>
                Depart Base
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, width: 20 }}>
                Sign Out
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roster.entries.map((entry, i) => (
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
      <TableCell align="center" size="small">
        {<RosterTime time={rosterEntry.timestamps[RosterStage.SignIn]} label="Sign In" name={rosterEntry.participantName} />}
      </TableCell>
      <TableCell align="center" size="small">
        {<RosterTime time={rosterEntry.timestamps[RosterStage.ArriveBase]} label="Arrive Base" name={rosterEntry.participantName} />}
      </TableCell>
      <TableCell align="center" size="small">
        {<RosterTime time={rosterEntry.timestamps[RosterStage.DepartBase]} label="Depart Base" name={rosterEntry.participantName} />}
      </TableCell>
      <TableCell align="center" size="small">
        {<RosterTime time={rosterEntry.timestamps[RosterStage.SignOut]} label="Sign Out" name={rosterEntry.participantName} />}
      </TableCell>
    </TableRow>
  );
}

function RosterTime({ time, label, name }: { time: number; label: string; name: string }) {
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Stack sx={{ cursor: 'pointer' }} onClick={() => handleOpen()}>
        {time ? <RosterTimeValue time={time} /> : <RosterTimeAdd />}
      </Stack>
      <RosterTimeEditDialog open={open} title={`Edit ${label} Time`} time={time ? time : Date.now()} name={name} onClose={handleClose} />
    </>
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

function RosterTimeAdd() {
  return (
    <Stack alignItems={'center'}>
      <AddIcon color="action" />
    </Stack>
  );
}

interface IRosterEditProps {
  open: boolean;
  title: string;
  time: number;
  name: string;
  onClose: () => void;
}

function RosterTimeEditDialog(props: IRosterEditProps) {
  const { open, title, time, name, onClose } = props;
  const handleSubmit = () => {
    // TODO: Update Participant
    onClose();
  };
  const handleCancel = () => {
    onClose();
  };
  return (
    <Dialog onClose={handleSubmit} open={open}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>{name}</DialogContentText>
          <RosterTimePicker time={time}></RosterTimePicker>
          <Button variant="contained" onClick={handleSubmit}>
            Submit
          </Button>
          <Button variant="outlined" onClick={handleCancel}>
            Cancel
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function RosterTimePicker({ time }: { time: number }) {
  const [value, setValue] = useState<number | null>(time ?? new Date());
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Stack spacing={2}>
        <DateTimePicker value={value} onChange={setValue} />
      </Stack>
    </LocalizationProvider>
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

interface IRosterEntry {
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
  let priorStage = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const t = timeline[i];
    const stage: RosterStage = rosterStages[t.status] ?? undefined;
    if (stage === RosterStage.NA) {
      if (i === 0) {
        newTimeline.unshift(t); // Keep if latest status
        priorStage = stage;
      }
      continue;
    }
    if (stage === RosterStage.SignOut) {
      newTimeline.unshift(t);
      priorStage = RosterStage.NA;
    }
    if (stage === priorStage + 1) {
      newTimeline.unshift(t);
      priorStage = stage;
    }
  }
  return newTimeline;
};

class Roster {
  entries: Array<RosterEntry> = [];

  constructor(activity: Activity) {
    Object.values(activity.participants ?? {}).forEach((participant: Participant) => {
      this.buildRosterEntries(participant);
    });
  }

  buildRosterEntries(participant: Participant) {
    const timeline: Array<ParticipantUpdate> = scrubTimeline(participant.timeline);
    for (let i = timeline.length - 1; i >= 0; i--) {
      const stage: RosterStage = rosterStages[timeline[i].status] ?? undefined;
      if (!stage) continue; // The participant status is not relavent to the roster.
      const rosterEntry = this.getRosterEntry(participant);
      rosterEntry.timestamps[stage] = timeline[i].time;
    }
  }

  getRosterEntry(participant: Participant): RosterEntry {
    return this.findRosterEntry(participant) ?? this.createRosterEntry(participant);
  }

  createRosterEntry(participant: Participant) {
    const newEntry = new RosterEntry(participant);
    this.entries.unshift(newEntry);
    return newEntry;
  }

  findRosterEntry(participant: Participant) {
    return this.entries.find((entry) => entry.participantId === participant.id && !entry.isComplete());
  }
}

class RosterEntry implements IRosterEntry {
  participantId;
  participantName;
  timestamps;
  miles;

  constructor(participant: Participant) {
    this.participantId = participant.id;
    this.participantName = `${participant.firstname} ${participant.lastname}`;
    this.timestamps = {
      [RosterStage.SignIn]: 0,
      [RosterStage.ArriveBase]: 0,
      [RosterStage.DepartBase]: 0,
      [RosterStage.SignOut]: 0,
    };
    this.miles = 0;
  }

  isComplete(): boolean {
    return !!this.timestamps[RosterStage.SignOut];
  }

  getLatestStage(): RosterStage {
    for (const [key, value] of Object.entries(this.timestamps).reverse()) {
      if (value) {
        return parseInt(key);
      }
    }
    return RosterStage.NA;
  }

  isNext(newStage: RosterStage): boolean {
    return this.getLatestStage() === newStage - 1;
  }
}
