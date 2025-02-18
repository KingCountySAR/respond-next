import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Stack, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { MemberProvider } from '@respond/components/member/MemberProvider';
import { useParticipantContext } from '@respond/components/participant/ParticipantProvider';
import { getStatusCssColor, getStatusText } from '@respond/types/activity';
import { stubMemberFromParticipant } from '@respond/types/member';

import { MemberInfo } from '../member/MemberInfo';

import { ParticipantHours } from './ParticipantHours';
import { ParticipantMiles } from './ParticipantMiles';
import { ParticipantOrgName } from './ParticipantOrgName';
import { ParticipantTags } from './ParticipantTags';
import { ParticipantTimeline } from './ParticipantTimeline';

export function ParticipantDialog({ open = true, onClose }: { open?: boolean; onClose: () => void }) {
  const participant = useParticipantContext();
  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  if (!participant) return <></>;

  const member = stubMemberFromParticipant(participant);

  return (
    <Dialog fullWidth open={open} onClose={onClose}>
      <DialogTitle style={{ borderBottom: 'solid 4px ' + getStatusCssColor(participant.timeline[0].status) }} alignItems="center" justifyContent="space-between" display="flex">
        <Box>{member.name}</Box>
        <Typography style={{ color: getStatusCssColor(participant.timeline[0].status) }}>{getStatusText(participant.timeline[0].status)}</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ pt: 2 }} divider={<Divider orientation={isMobile ? 'horizontal' : 'vertical'} flexItem />}>
          <Box>
            <MemberProvider member={member}>
              <MemberInfo.Photo />
              <ParticipantOrgName fontWeight={600} />
              <ParticipantTags />
              <MemberInfo.Phone />
              <MemberInfo.Email />
            </MemberProvider>
          </Box>
          <Stack spacing={2} flexGrow={1}>
            <ParticipantHours />
            <ParticipantMiles />
            <ParticipantTimeline />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
