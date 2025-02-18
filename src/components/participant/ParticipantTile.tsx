import { Card, CardActionArea, Paper, PaperProps, Stack } from '@mui/material';
import { ReactNode, useState } from 'react';

import { getStatusCssColor, Participant } from '@respond/types/activity';

import { ParticipantDialog } from './ParticipantDialog';
import { ParticipantProvider } from './ParticipantProvider';

export function ParticipantTile({ participant, children, ...props }: PaperProps & { participant: Participant; children: ReactNode }) {
  const statusColor = getStatusCssColor(participant.timeline[0].status) ?? 'transparent';
  const [showDialog, setShowDialog] = useState(false);
  return (
    <ParticipantProvider participant={participant}>
      <Card elevation={1} {...props}>
        <CardActionArea onClick={() => setShowDialog(true)}>
          <Stack direction="row" minHeight="3rem">
            <Paper elevation={2} sx={{ width: 8, bgcolor: statusColor, borderBottomRightRadius: 0, borderTopRightRadius: 0 }} />
            {children}
          </Stack>
        </CardActionArea>
      </Card>
      {showDialog && <ParticipantDialog onClose={() => setShowDialog(false)} />}
    </ParticipantProvider>
  );
}
