import { Box, Paper, Stack, Typography } from '@mui/material';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import type { PaperProps } from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import { useState, type FunctionComponent, type ReactNode } from 'react';
import type { ParticipantStatus } from '@sync/domain';
import type { RespondParticipant } from '@sync/model';
import { observer } from '@sync/model/react';
import { STATUS_SORT_ORDER, statusCssColor } from '../../../ui/status';

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
