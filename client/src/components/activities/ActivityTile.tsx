import { NearMe } from '@mui/icons-material';
import { Box, Card, CardActions, Grid, IconButton, Link, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { PropsWithChildren } from 'react';
import { Link as RouterLink } from 'wouter';

import { usePreferences } from '@respond/components/PreferencesProvider';
import { StatusChip } from '@respond/components/StatusChip';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import type { ParticipantStatus } from '@respond/shared/types/activity';
import { NavigationApp } from '@respond/shared/types/preferences';

import { ActivityDomainModel } from '@/client/models/activityDomainModel';

export const ActivityTile = observer(function ActivityTile({ activity, status, children }: PropsWithChildren<{ activity: ActivityDomainModel; status?: ParticipantStatus }>) {
  if (!activity.activityLoaded) return null;
  return (
    <Card>
      <Box sx={{ padding: 1 }}>
        <Box sx={{ alignItems: 'center', pb: 2, display: 'flex', flexDirection: 'row' }}>
          <Box sx={{ flexGrow: 1 }}>
            <Link component={RouterLink} href={activity.path} color="textPrimary" underline="hover">
              <Typography sx={{ fontWeight: 'bold' }} variant="h6">
                {activity.title}
              </Typography>
            </Link>
          </Box>
          <Box>{status && <StatusChip status={status} />}</Box>
        </Box>
        <Box>{children}</Box>
      </Box>

      {activity.isActive && (
        <CardActions>
          <Grid container sx={{ flexGrow: 1, justifyContent: 'space-between', alignItems: 'center' }}>
            <Grid>
              {activity.mapId && (
                <IconButton aria-label="Map" href={`https://sartopo.com/m/${activity.mapId}`} target="_blank">
                  <img src="/sartopo-logo.svg" alt="SARTopo Logo" width={25} height={25} />
                </IconButton>
              )}
              <NavigationButton lat={activity.location.lat} lon={activity.location.lon} />
            </Grid>
            <Grid>
              <StatusUpdater activity={activity} />
            </Grid>
          </Grid>
        </CardActions>
      )}
    </Card>
  );
});

const NavigationButton = ({ lat, lon }: { lat?: string; lon?: string }) => {
  const { navigationApp } = usePreferences();
  const mapUrl = {
    [NavigationApp.Apple]: 'http://maps.apple.com/?daddr=',
    [NavigationApp.Google]: 'https://www.google.com/maps/place/',
    [NavigationApp.Waze]: 'https://waze.com/ul?navigate=yes&ll=',
  };
  const url = lat && lon ? `${mapUrl[navigationApp]}${lat},${lon}` : undefined;
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
