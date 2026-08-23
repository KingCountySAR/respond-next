import PhoneIcon from '@mui/icons-material/Phone';
import { Box, Button, ButtonBase, Chip, DialogActions, DialogContent, DialogTitle, Divider, Paper, Stack, Typography, useMediaQuery } from '@mui/material';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import { PaperProps } from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import { observer } from 'mobx-react-lite';
import { FunctionComponent, ReactNode, useState } from 'react';

import { getStatusCssColor, ParticipantStatus } from '@respond/shared/types/activity';

import DialogWithHistory from '@/client/components/DialogWithHistory';
import { ParticipantMilesUpdater } from '@/client/components/participant/ParticipantMilesUpdater';
import { ParticipantDomainModel } from '@/client/models/participantDomainModel';
import { RosterViewModel } from '@/client/pages/reports/rosterReportViewModel';

import ParticipantTimeline from './ParticipantTimeline';

interface RosterPanelProps {
  roster: RosterViewModel;
  participantContainerComponent: FunctionComponent<{ children: ReactNode }>;
  participantRowComponent: FunctionComponent<{ participant: ParticipantDomainModel; onClick?: () => void }>;
  onClick?: (participant: ParticipantDomainModel) => void;
}

export const RosterPanel = observer(function RosterPanel({ roster, participantContainerComponent: Participants, participantRowComponent: Row, onClick }: RosterPanelProps) {
  let cards: ReactNode = roster.participants.map((p) => <Row key={p.id} participant={p} onClick={() => onClick?.(p)} />);
  if (roster.participants.length == 0) {
    cards = (
      <RosterRowCard status={ParticipantStatus.NotResponding}>
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
      <Paper elevation={2} sx={{ width: 8, bgcolor: getStatusCssColor(status) ?? 'transparent', borderBottomRightRadius: 0, borderTopRightRadius: 0 }} />
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

export const ParticipantDialog = observer(({ open, participant, onClose }: { open: boolean; onClose: () => void; participant?: ParticipantDomainModel }) => {
  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  if (!participant) return <></>;

  return (
    <DialogWithHistory fullWidth open={open} onClose={onClose}>
      <DialogTitle style={{ borderBottom: 'solid 4px ' + participant.statusColor }} sx={{ alignItems: 'center', justifyContent: 'space-between', display: 'flex' }}>
        <Box>{participant.fullName}</Box>
        <Typography style={{ color: participant.statusColor }}>{participant.statusText}</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ pt: 2 }} divider={<Divider orientation={isMobile ? 'horizontal' : 'vertical'} flexItem />}>
          <Box>
            <img //
              src={`/api/v1/organizations/${participant.organizationId}/members/${participant.id}/photo`}
              alt={`Photo of ${participant.fullName}`}
              style={{ width: '8rem', minHeight: '10rem', border: 'solid 1px #777', borderRadius: '4px' }}
            />
            <Typography sx={{ fontWeight: 600 }}>{participant.organizationName}</Typography>
            <Box>
              {participant.tags.map((t) => (
                <Chip sx={{ mr: '3px' }} key={t} label={t} variant="outlined" size="small" />
              ))}
            </Box>
            {participant.mobilePhoneFormatted &&
              (isMobile ? (
                <Button fullWidth component="a" href={`tel:${participant.mobilePhone}`} variant="contained" size="small" startIcon={<PhoneIcon />} sx={{ textTransform: 'none', my: 1 }}>
                  {participant.mobilePhoneFormatted}
                </Button>
              ) : (
                <Typography>{participant.mobilePhoneFormatted}</Typography>
              ))}
            {participant.email && (
              <Typography>
                <a href={`mailto:${participant.email}`}>{participant.email}</a>
              </Typography>
            )}
          </Box>
          <Stack spacing={2} sx={{ flexGrow: 1 }}>
            <ParticipantHoursText participant={participant} />
            <ParticipantMiles participant={participant} />
            <Typography variant="h6" sx={{ borderBottom: 1 }}>
              Timeline
            </Typography>
            <ParticipantTimeline participant={participant} />
          </Stack>
        </Stack>
        {/* <DialogContentText>Mark this activity as deleted? Any data it contains will stop contributing to report totals.</DialogContentText> */}
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </DialogWithHistory>
  );
});

const ParticipantHoursText = observer(({ participant }: { participant: Pick<ParticipantDomainModel, 'timeOnClock'> }) => {
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

const ParticipantMiles = observer(function ParticipantMiles({ participant }: { participant: Pick<ParticipantDomainModel, 'miles' | 'updateMiles'> }) {
  const [edit, setEdit] = useState(false);
  return (
    <>
      {!edit && (
        <ButtonBase sx={{ width: '100%' }} onClick={() => setEdit(true)}>
          <Stack sx={{ width: '100%', justifyContent: 'space-between' }} direction="row" spacing={2}>
            <Typography variant="h6">Total Miles:</Typography>
            <Typography variant="h6" align="right" sx={{ flexGrow: 1 }}>
              {participant.miles ?? 0}
            </Typography>
          </Stack>
        </ButtonBase>
      )}
      {edit && (
        <>
          <Typography variant="h6">Updating Miles</Typography>
          <ParticipantMilesUpdater participant={participant} onCancel={() => setEdit(false)} onSubmit={() => setEdit(false)} />
        </>
      )}
    </>
  );
});
