import { Box, Card, CardActions, Grid, IconButton, Link, Typography } from '@mui/material';
import Image from 'next/image';
import { ReactNode } from 'react';

import { StatusChip } from '@respond/components/StatusChip';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { getActivityPath, isActive } from '@respond/lib/client/store/activities';
import { Activity, ParticipantStatus } from '@respond/types/activity';

export const ActivityTile = ({ activity, status, children }: { activity: Activity; status?: ParticipantStatus; children?: ReactNode }) => {
  return (
    <Card>
      <Box padding={1}>
        <Box sx={{ pb: 2, display: 'flex', flexDirection: 'row' }} alignItems="center">
          <Box sx={{ flexGrow: 1 }}>
            <Link href={getActivityPath(activity)} color="textPrimary" underline="hover">
              <Typography sx={{ fontWeight: 'bold' }} variant="h6">
                {activity.title}
              </Typography>
            </Link>
          </Box>
          <Box>{status && <StatusChip status={status} />}</Box>
        </Box>
        <Box>{children}</Box>
      </Box>

      {isActive(activity) && (
        <CardActions>
          <Grid container justifyContent="space-between" alignItems="center">
            <Grid item>
              {activity.mapId && (
                <IconButton aria-label="Map" href={`https://sartopo.com/m/${activity.mapId}`} target="_blank">
                  <Image src="/sartopo-logo.svg" alt="Sartopo Logo" width={25} height={25} />
                </IconButton>
              )}
              {/* TODO: When we have necessary attribute to implement nav button, do it here.
                <Button aria-label="Navigate" color="info">
                  <NearMe /> Navigate
                </Button>
                */}
            </Grid>
            <Grid item>
              <StatusUpdater activity={activity} />
            </Grid>
          </Grid>
        </CardActions>
      )}
    </Card>
  );
};