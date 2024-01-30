import { NearMe } from '@mui/icons-material';
import { Box, Card, CardActions, Grid, IconButton, Link, Typography } from '@mui/material';
import Image from 'next/image';
import { ReactNode } from 'react';

import { StatusChip } from '@respond/components/StatusChip';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { useAppSelector } from '@respond/lib/client/store';
import { getActivityPath, isActive } from '@respond/lib/client/store/activities';
import { NavigationApp } from '@respond/lib/client/store/preferences';
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
                  <Image src="/sartopo-logo.svg" alt="SARTopo Logo" width={25} height={25} />
                </IconButton>
              )}
              <NavigationButton lat={activity.location.lat} lon={activity.location.lon} />
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

const NavigationButton = ({ lat, lon }: { lat?: string; lon?: string }) => {
  const navApp: NavigationApp = useAppSelector((state) => state.preferences.navigationApp);
  const mapUrl = {
    [NavigationApp.Apple]: 'http://maps.apple.com/?daddr=',
    [NavigationApp.Google]: 'https://www.google.com/maps/place/',
    [NavigationApp.Waze]: 'https://waze.com/ul?navigate=yes&ll=',
  };
  const url = lat && lon ? `${mapUrl[navApp]}${lat},${lon}` : undefined;
  return (
    <>
      {url && (
        <IconButton aria-label="Navigate" color="info" href={url} target="_blank">
          <NearMe />
        </IconButton>
      )}
    </>
  );
};
