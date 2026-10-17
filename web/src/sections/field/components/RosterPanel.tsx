import PhoneIcon from '@mui/icons-material/Phone';
import { Box, Button, ButtonBase, Chip, DialogActions, DialogContent, DialogTitle, Divider, Paper, Stack, Typography, useMediaQuery } from '@mui/material';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import type { PaperProps } from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import { useState, type FunctionComponent, type ReactNode } from 'react';
import type { ParticipantStatus } from '@sync/domain';
import { isCommandActivity, type FieldParticipant } from '@sync/model';
import { observer } from '@sync/model/react';
import { AppDialog } from '../../../shell/dialogs/AppDialog';
import { STATUS_SORT_ORDER, statusCssColor, statusText } from '../../../ui/status';
import { ParticipantMilesUpdater } from './ParticipantMilesUpdater';
import { ParticipantTimeline } from './ParticipantTimeline';

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

const enrouteRank = (p: FieldParticipant) => (p.isEnrouteOrStandby ? 1 : 0);
const sortByStatus = (a: FieldParticipant, b: FieldParticipant) =>
  STATUS_SORT_ORDER.indexOf(a.status) - STATUS_SORT_ORDER.indexOf(b.status) || enrouteRank(b) - enrouteRank(a) || (a.record?.eta ?? Infinity) - (b.record?.eta ?? Infinity);
const sortByFirstName = (a: FieldParticipant, b: FieldParticipant) => (a.record?.firstname ?? '').localeCompare(b.record?.firstname ?? '');

interface RosterPanelProps {
  participants: FieldParticipant[];
  roster: RosterState;
  participantContainerComponent: FunctionComponent<{ children: ReactNode }>;
  participantRowComponent: FunctionComponent<{ participant: FieldParticipant; onClick?: () => void }>;
  onClick?: (participant: FieldParticipant) => void;
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

export const ParticipantDialog = observer(({ open, participant, onClose }: { open: boolean; onClose: () => void; participant?: FieldParticipant }) => {
  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  if (!participant) return <></>;
  const color = statusCssColor(participant.status);
  const unitName = participant.unit?.name ?? '';
  const memberId = participant.record?.personRef?.split(':')[1];
  const mobile = participant.contact?.mobile?.replace(/\D/g, '') ?? '';
  const email = participant.contact?.email ?? '';
  const command = isCommandActivity(participant.activity);
  // Field viewers may change only their own miles.
  const canEditMiles = command || participant.isMe;

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
        <Button autoFocus onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </AppDialog>
  );
});

const ParticipantHoursText = observer(({ participant }: { participant: FieldParticipant }) => {
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

const ParticipantMiles = observer(function ParticipantMiles({ participant, canEdit }: { participant: FieldParticipant; canEdit: boolean }) {
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
