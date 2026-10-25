import PhoneIcon from '@mui/icons-material/Phone';
import { Box, Button, ButtonBase, Chip, DialogActions, DialogContent, DialogTitle, Divider, Paper, Stack, Typography, useMediaQuery } from '@mui/material';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import type { PaperProps } from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import { useEffect, useState, type FunctionComponent, type ReactNode } from 'react';
import type { ParticipantStatus } from '@sync/domain';
import { isManageActivity, type RespondParticipant } from '@sync/model';
import { observer } from '@sync/model/react';
import { useApi } from '../../../shell/api';
import { useSyncClient } from '../../../shell/sync';
import { AppDialog } from '../../../shell/dialogs/AppDialog';
import { STATUS_SORT_ORDER, statusCssColor, statusText } from '../../../ui/status';
import { ParticipantMilesUpdater } from './ParticipantMilesUpdater';
import { ParticipantTimeline } from './ParticipantTimeline';
import { StatusUpdater } from './StatusUpdater';

/** The roster's view state: the unit filter and the sort. Shared by the desktop and mobile pages. */
export interface RosterState {
  /** Unit id to show, or '' for everyone. */
  filter: string;
  setFilter(unitId: string): void;
  sortOnStatus: boolean;
  setSortOnStatus(on: boolean): void;
}

export function useRosterState(): RosterState {
  const [filter, setFilter] = useState('');
  const [sortOnStatus, setSortOnStatus] = useState(false);
  return { filter, setFilter, sortOnStatus, setSortOnStatus };
}

const enrouteRank = (p: RespondParticipant) => (p.isEnrouteOrStandby ? 1 : 0);
const sortByStatus = (a: RespondParticipant, b: RespondParticipant) =>
  STATUS_SORT_ORDER.indexOf(a.status) - STATUS_SORT_ORDER.indexOf(b.status) || enrouteRank(b) - enrouteRank(a) || (a.record?.eta ?? Infinity) - (b.record?.eta ?? Infinity);
const sortByFirstName = (a: RespondParticipant, b: RespondParticipant) => (a.record?.firstname ?? '').localeCompare(b.record?.firstname ?? '');

interface RosterPanelProps {
  participants: RespondParticipant[];
  roster: RosterState;
  participantContainerComponent: FunctionComponent<{ children: ReactNode }>;
  participantRowComponent: FunctionComponent<{ participant: RespondParticipant; onClick?: () => void }>;
  onClick?: (participant: RespondParticipant) => void;
}

export const RosterPanel = observer(function RosterPanel({ participants, roster, participantContainerComponent: Participants, participantRowComponent: Row, onClick }: RosterPanelProps) {
  const shown = (roster.filter ? participants.filter((p) => p.unit?.id === roster.filter) : [...participants]).sort(roster.sortOnStatus ? sortByStatus : sortByFirstName);
  let cards: ReactNode = shown.map((p) => <Row key={p.id} participant={p} onClick={() => onClick?.(p)} />);
  if (shown.length == 0) {
    cards = (
      <RosterRowCard status="notResponding">
        <Typography sx={{ p: 2 }}>No responders with the selected filter</Typography>
      </RosterRowCard>
    );
  }

  return (
    <Box sx={{ flex: '1 1 auto' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'right' }}>
        <Typography>Sort By: Name</Typography>
        <Switch checked={roster.sortOnStatus} onChange={(event) => roster.setSortOnStatus(event.target.checked)} color="primary" />
        <Typography>Status</Typography>
      </Stack>
      <Participants>{cards}</Participants>
    </Box>
  );
});

export function RosterRowCard({ status, children, onClick, ...props }: PaperProps & { status: ParticipantStatus; children: ReactNode; onClick?: () => void }) {
  let cardContent = (
    <Stack direction="row" sx={{ minHeight: '3rem' }}>
      <Paper elevation={2} sx={{ width: 8, bgcolor: statusCssColor(status), borderBottomRightRadius: 0, borderTopRightRadius: 0 }} />
      {children}
    </Stack>
  );
  if (onClick) {
    cardContent = <CardActionArea onClick={onClick}>{cardContent}</CardActionArea>;
  }

  return (
    <Card elevation={1} {...props}>
      {cardContent}
    </Card>
  );
}

/** `(206) 555-0100` from a stored number, as the legacy dialog showed it. */
function formatPhone(digits: string): string {
  const match = digits.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
  return match ? ['(', match[2], ') ', match[3], '-', match[4]].join('') : '';
}

export const ParticipantDialog = observer(({ open, participant, onClose }: { open: boolean; onClose: () => void; participant?: RespondParticipant }) => {
  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  if (!participant) return <></>;
  const color = statusCssColor(participant.status);
  const unitName = participant.unit?.name ?? '';
  const memberId = participant.record?.personRef?.split(':')[1];
  const mobile = participant.contact?.mobile?.replace(/\D/g, '') ?? '';
  const email = participant.contact?.email ?? '';
  const manager = isManageActivity(participant.activity);
  // Respond viewers may change only their own miles and status.
  const canEditMiles = manager || participant.isMe;
  const record = participant.record;
  const unit = participant.unit?.record;
  const statusPerson = record?.personRef && unit && !participant.activity.record?.closed && (manager || participant.isMe) ? { personRef: record.personRef, firstname: record.firstname, lastname: record.lastname } : undefined;

  return (
    <AppDialog fullWidth open={open} onClose={onClose}>
      <DialogTitle style={{ borderBottom: 'solid 4px ' + color }} sx={{ alignItems: 'center', justifyContent: 'space-between', display: 'flex' }}>
        <Box>{participant.name}</Box>
        <Typography style={{ color }}>{statusText(participant.status)}</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ pt: 2 }} divider={<Divider orientation={isMobile ? 'horizontal' : 'vertical'} flexItem />}>
          <Box>
            <img //
              src={`/api/v1/organizations/${participant.unit?.id}/members/${memberId}/photo`}
              alt={`Photo of ${participant.name}`}
              style={{ width: '8rem', minHeight: '10rem', border: 'solid 1px #777', borderRadius: '4px' }}
            />
            <Typography sx={{ fontWeight: 600 }}>{unitName}</Typography>
            <Box>
              {participant.tags.map((t) => (
                <Chip sx={{ mr: '3px' }} key={t} label={t} variant="outlined" size="small" />
              ))}
            </Box>
            {formatPhone(mobile) &&
              (isMobile ? (
                <Button fullWidth component="a" href={`tel:${mobile}`} variant="contained" size="small" startIcon={<PhoneIcon />} sx={{ textTransform: 'none', my: 1 }}>
                  {formatPhone(mobile)}
                </Button>
              ) : (
                <Typography>{formatPhone(mobile)}</Typography>
              ))}
            {email && (
              <Typography>
                <a href={`mailto:${email}`}>{email}</a>
              </Typography>
            )}
          </Box>
          <Stack spacing={2} sx={{ flexGrow: 1 }}>
            <ParticipantHoursText participant={participant} />
            <ParticipantMiles participant={participant} canEdit={canEditMiles} />
            <Typography variant="h6" sx={{ borderBottom: 1 }}>
              Timeline
            </Typography>
            <ParticipantTimeline participant={participant} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <ManageGrantButton participant={participant} />
        {statusPerson && unit && <StatusUpdater activity={participant.activity} person={statusPerson} unit={unit} />}
        <Button autoFocus onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </AppDialog>
  );
});

const ParticipantHoursText = observer(({ participant }: { participant: RespondParticipant }) => {
  // Round to the nearest quarter hour.
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
      <Typography variant="h6">Total Hours:</Typography>
      <Typography variant="h6" align={'right'} sx={{ flexGrow: 1 }}>
        {Math.round(participant.timeOnClock / 1000 / 60 / 15) / 4}
      </Typography>
    </Stack>
  );
});

const ParticipantMiles = observer(function ParticipantMiles({ participant, canEdit }: { participant: RespondParticipant; canEdit: boolean }) {
  const [edit, setEdit] = useState(false);
  const miles = participant.record?.miles ?? 0;
  return (
    <>
      {!edit && (
        <ButtonBase sx={{ width: '100%' }} disabled={!canEdit} onClick={() => setEdit(true)}>
          <Stack sx={{ width: '100%', justifyContent: 'space-between' }} direction="row" spacing={2}>
            <Typography variant="h6">Total Miles:</Typography>
            <Typography variant="h6" align="right" sx={{ flexGrow: 1 }}>
              {miles}
            </Typography>
          </Stack>
        </ButtonBase>
      )}
      {edit && (
        <>
          <Typography variant="h6">Updating Miles</Typography>
          <ParticipantMilesUpdater participant={participant} currentMiles={miles} onCancel={() => setEdit(false)} onSubmit={() => setEdit(false)} />
        </>
      )}
    </>
  );
});

/**
 * For a manager of this mission: let this person manage it too, or take that away. It counts
 * on this mission only, at once. Not for other kinds: members manage those anyway.
 */
function ManageGrantButton({ participant }: { participant: RespondParticipant }) {
  const api = useApi();
  const client = useSyncClient();
  const personRef = participant.record?.personRef;
  const { activityId } = participant.activity;
  const shown = participant.activity.record?.kind === 'mission' && client.viewerIn(activityId).tier === 'manage' && !!personRef && !participant.isMe;
  // undefined until known; null for no grant.
  const [granted, setGranted] = useState<boolean | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!shown) return;
    let live = true;
    api.grantOf(activityId, personRef).then(
      (g) => live && setGranted(g?.tier === 'manage'),
      (err: unknown) => live && setError(err instanceof Error ? err.message : String(err)),
    );
    return () => {
      live = false;
    };
  }, [api, activityId, personRef, shown]);

  if (!shown || (granted === undefined && !error)) return null;
  const change = async () => {
    setError(undefined);
    try {
      if (granted) await api.revokeGrant(activityId, personRef);
      else await api.grant(activityId, personRef, 'manage');
      setGranted(!granted);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return (
    <>
      {error && <Typography color="error" sx={{ mr: 'auto' }}>{error}</Typography>}
      {granted !== undefined && <Button onClick={() => void change()}>{granted ? 'Remove manage access' : 'Grant manage access'}</Button>}
    </>
  );
}
