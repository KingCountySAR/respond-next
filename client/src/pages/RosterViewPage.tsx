import { Activity, Participant, ParticipantStatus, ParticipantUpdate } from '@app/shared/api';
import { Alert, Box, Button, Divider, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { OutputForm, OutputText, OutputTime } from '@respond/components/OutputForm';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { ActivitiesStore, useActivitiesContext } from '@respond/store/activitiesStore';
import { differenceInCalendarDays, format as formatDate } from 'date-fns';
import { computed, makeObservable, observable, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { ForwardedRef, forwardRef, JSX, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router';
import { useReactToPrint } from 'react-to-print';

const headerCellStyle = { fontWeight: 700, width: 20 };

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

interface RosterViewModel {
  activity: {
    idNumber: string;
    title: string;
    start: number;
    startText: string;
    end?: number;
    endText: string;
  }
  rosterEntries: RosterEntryViewModel[];
}

interface RosterEntryViewModel {
  participant: {
    id: string;
    name: string;
  };
  organization: {
    name: string;
  };
  timestamps: {
    [RosterStage.SignIn]: SplitTimeViewModel;
    [RosterStage.ArriveBase]: SplitTimeViewModel;
    [RosterStage.DepartBase]: SplitTimeViewModel;
    [RosterStage.SignOut]: SplitTimeViewModel;
  };
  miles: number;
}

interface SplitTimeViewModel {
  /** Format for CSV download */
  text: string;
  /** 24-hr hour+minute */
  timePart: string;
  /** If not on the mission start date, the date */
  datePart: string;
}

class RosterViewUiStore {
  @observable accessor isLoading: boolean = true;
  @observable accessor apiActivity: Activity|undefined = undefined;

  constructor(private readonly activitiesStore: ActivitiesStore, private readonly activityId: string) {
    makeObservable(this);
  }

  async load() {
    try {
      const activity = await this.activitiesStore.getActivity(this.activityId);
      runInAction(() => this.apiActivity = activity);
    } finally {
      runInAction(() => this.isLoading = false);
    }
  }

  downloadAsCSV() {
    const data = this.roster.rosterEntries.map((e) => {
      return [e.participant.id, e.participant.name, e.organization.name, ...Object.values(e.timestamps).map(t => t.text ), e.miles]
        .map(String) // convert every value to String
        .map((v) => v.replaceAll('"', '""')) // escape double quotes
        .map((v) => `"${v}"`) // quote it
        .join(','); // comma-separated;
    });
    data.unshift('"participant_id","participant_name","organization_name","sign_in","arrive_base","depart_base","sign_out","miles"');
    const blob = new Blob([data.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Create a link to download it
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.setAttribute('download', 'roster.csv');
    anchor.click();
    anchor.remove();
  }

  @computed
  get roster(): RosterViewModel {
    if (!this.apiActivity) {
      throw new Error('don\'t call this when there\'s no activity');
    }

    return {
      activity: {
        idNumber: this.apiActivity.idNumber,
        title: this.apiActivity.title,
        start: this.apiActivity.startTime,
        startText: 'TODO start',
        end: this.apiActivity.endTime,
        endText: this.apiActivity.endTime ? 'TODO end' : '',
      },
      rosterEntries: this.getRosterEntries(this.apiActivity),
    };
  }

  @computed
  get pageError(): string|undefined {
    if (!this.isLoading && !this.apiActivity) {
      return 'Activity not found';
    }
  }

  private buildRosterEntry(participant: Participant, organizationName: string): RosterEntryViewModel {
    return {
      participant: {
        id: participant.id,
        name: `${participant.firstname} ${participant.lastname}`,
      },
      organization: {
        name: organizationName,
      },
      timestamps: {
        [RosterStage.SignIn]: { text: '', timePart: '', datePart: '' },
        [RosterStage.ArriveBase]: { text: '', timePart: '', datePart: '' },
        [RosterStage.DepartBase]: { text: '', timePart: '', datePart: '' },
        [RosterStage.SignOut]: { text: '', timePart: '', datePart: '' },
      },
      miles: 0,
    };
  };

  private isComplete(entry: RosterEntryViewModel): boolean {
    return !!entry.timestamps[RosterStage.SignOut].text;
  }

  private scrubTimeline(timeline: Array<ParticipantUpdate>): Array<ParticipantUpdate> {
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
  }

  private getRosterEntries(activity?: Activity) {
    if (!activity) return [];

    const rosterEntries: Array<RosterEntryViewModel> = [];

    const buildRosterEntries = (participant: Participant) => {
      const timeline: Array<ParticipantUpdate> = this.scrubTimeline(participant.timeline);
      for (let i = timeline.length - 1; i >= 0; i--) {
        const t = timeline[i];
        const stage: RosterStage = rosterStages[t.status] ?? undefined;
        if (!stage) continue; // The participant status is not relavent to the roster.
        let rosterEntry = findRosterEntry(participant);
        if (rosterEntry === undefined) {
          if (stage !== RosterStage.SignIn) {
            continue; // Skip orphaned status transitions by requiring a sign in status first.
          } else {
            rosterEntry = createRosterEntry(participant, t.organizationId);
          }
        }

        const dateDiff = Math.abs(differenceInCalendarDays(new Date(activity.startTime), new Date(t.time)));

        const dateString = new Date(t.time).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
        const timeString = new Date(t.time).toLocaleString('en-US', { hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).replace(':', '');

        rosterEntry.timestamps[stage] = {
          text: formatDate(t.time, 'MM/dd/yy hh:mm a'),
          timePart: timeString,
          datePart: dateDiff ? dateString : '',
        };
      }
      // Miles are currently only tracked in aggregate at the participant level. For now, we only
      // want to append them to the first roster entry for this participant.
      const firstEntry = rosterEntries.reverse().find((entry) => entry.participant.id === participant.id);
      if (firstEntry) {
        firstEntry.miles = participant.miles ?? 0;
      }
    };

    const createRosterEntry = (participant: Participant, organizationId: string) => {
      const o = activity.organizations[organizationId];
      const org = o.rosterName ?? o.title;
      const newEntry = this.buildRosterEntry(participant, org);
      rosterEntries.unshift(newEntry);
      return newEntry;
    };

    const findRosterEntry = (participant: Participant) => {
      return rosterEntries.find((entry) => entry.participant.id === participant.id && !this.isComplete(entry));
    };

    Object.values(activity.participants ?? {}).forEach((participant: Participant) => {
      buildRosterEntries(participant);
    });

    return rosterEntries;
  };
}

const RosterViewPage = observer(() => {
  const { activityId } = useParams();
  const activitiesContext = useActivitiesContext();
  const store = useMemo(() => new RosterViewUiStore(activitiesContext, activityId ?? ''), [ activitiesContext, activityId ]);

  const printable = useRef<HTMLTableElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printable });

  useEffect(() => {
    store.load();
  }, []);

  const withPageChrome = (content: JSX.Element) => (
    <ToolbarPage maxWidth="lg">{content}</ToolbarPage>
  );

  if (store.isLoading) {
    return withPageChrome(<div>Loading Activity...</div>);
  } else if (store.pageError) {
    return withPageChrome(<Alert severity="error">{store.pageError}</Alert>);
  } else {
    return withPageChrome(
      <Stack direction="row" flex="1 1 auto" spacing={1} divider={<Divider orientation="vertical" flexItem />}>
        <Box display="flex" flex="1 1 auto" flexDirection="column">
          <Paper><Roster ref={printable} roster={store.roster} /></Paper>
        </Box>
        <Stack alignItems="stretch" spacing={2}>
          <Button variant="outlined" onClick={() => store.downloadAsCSV()}>
            Download (csv)
          </Button>
          <Button variant="outlined" onClick={handlePrint}>
            Print
          </Button>
        </Stack>
      </Stack>
    );
  }
});

const Roster = forwardRef(function Roster({ roster }: { roster: RosterViewModel }, ref: ForwardedRef<HTMLTableElement|null>) {
  return (
    <>
      <Table ref={ref} size="small">
        <TableHead>
          <TableRow>
            <TableCell colSpan={7}>
              <OutputForm columns={2}>
                <Stack>
                  <OutputText label="Name" value={roster.activity.title}></OutputText>
                  <OutputText label="State #" value={roster.activity.idNumber}></OutputText>
                </Stack>
                <Stack>
                  <OutputTime time={roster.activity.start} label="Start Time"></OutputTime>
                  <OutputTime time={roster.activity.end} label="End Time"></OutputTime>
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
          {roster.rosterEntries.map((entry, i) => (
            <RosterRow key={i} rosterEntry={entry} activityStartTime={roster.activity.start} />
          ))}
        </TableBody>
      </Table>
      {roster.rosterEntries.length === 0 && (
        <Alert severity="info">Roster is empty</Alert>
      )}
    </>
  );
});

function RosterRow({ rosterEntry }: { activityStartTime: number; rosterEntry: RosterEntryViewModel }) {
  return (
    <TableRow>
      <TableCell>{rosterEntry.participant.name}</TableCell>
      <TableCell>{rosterEntry.organization.name}</TableCell>
      {Object.values(rosterEntry.timestamps).map((time, i) => (
        <TableCell key={i}>
          <Stack>
            <Typography variant="h6">{time.timePart}</Typography>
            {time.datePart && <Typography variant="caption">{time.datePart}</Typography>}
          </Stack>
        </TableCell>
      ))}
      <TableCell>
        <Typography variant="h6">{rosterEntry.miles}</Typography>
      </TableCell>
    </TableRow>
  );
}

export default RosterViewPage;
