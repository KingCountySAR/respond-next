import { NearMe } from '@mui/icons-material';
import { Box, Card, CardActions, Chip, Grid, IconButton, Link, Typography } from '@mui/material';
import type { BoxProps } from '@mui/material/Box';
import type { PropsWithChildren } from 'react';
import { Link as RouterLink } from 'wouter';
import type { ParticipantStatus } from '@sync/domain';
import type { ActivityListItem } from '@sync/model';
import { ActivityModelProvider, observer, useRespondActivity } from '@sync/model/react';
import caltopoLogo from '../../../assets/caltopo-logo.svg';
import { NavigationApp, usePreferences } from '../../../shell/preferences';
import { useSyncClient } from '../../../shell/sync';
import { StatusChip } from '../../../ui/StatusChip';
import { unitChipColor } from '../../../ui/status';
import { StatusUpdater } from './StatusUpdater';

/** The legacy URL for a listed activity. */
export const listedPath = (item: ActivityListItem): string => `/${item.isMission ? 'mission' : 'event'}/${item.id}`;

export const ActivityTile = observer(function ActivityTile({ item, status, children }: PropsWithChildren<{ item: ActivityListItem; status?: ParticipantStatus }>) {
  const a = item.activity;
  if (!a) return null;
  return (
    <Card>
      <Box sx={{ padding: 1 }}>
        <Box sx={{ alignItems: 'center', pb: 2, display: 'flex', flexDirection: 'row' }}>
          <Box sx={{ flexGrow: 1 }}>
            <Link component={RouterLink} href={`~${listedPath(item)}`} color="textPrimary" underline="hover">
              <Typography sx={{ fontWeight: 'bold' }} variant="h6">
                {a.title}
              </Typography>
            </Link>
          </Box>
          <Box>{status && <StatusChip status={status} />}</Box>
        </Box>
        <Box>{children}</Box>
      </Box>

      {item.isActive && (
        <CardActions>
          <Grid container sx={{ flexGrow: 1, justifyContent: 'space-between', alignItems: 'center' }}>
            <Grid>
              {a.mapId && (
                <IconButton aria-label="Map" href={`https://caltopo.com/m/${a.mapId}`} target="_blank">
                  <img src={caltopoLogo} alt="CalTopo Logo" width={25} height={25} />
                </IconButton>
              )}
              <NavigationButton lat={a.location.lat} lon={a.location.lon} />
            </Grid>
            <Grid>
              <TileStatusUpdater activityId={item.id} />
            </Grid>
          </Grid>
        </CardActions>
      )}
    </Card>
  );
});

/**
 * The status button for an activity in a list. Changing status needs the activity itself, so the
 * tile opens it (listed activities that are still active are few) and the button appears once it's loaded.
 */
function TileStatusUpdater({ activityId }: { activityId: string }) {
  return (
    <ActivityModelProvider client={useSyncClient()} activityId={activityId}>
      <LoadedStatusUpdater />
    </ActivityModelProvider>
  );
}

const LoadedStatusUpdater = observer(function LoadedStatusUpdater() {
  const activity = useRespondActivity();
  return activity.record ? <StatusUpdater activity={activity} /> : null;
});

const NavigationButton = ({ lat, lon }: { lat: number | null; lon: number | null }) => {
  const { navigationApp } = usePreferences();
  const mapUrl = {
    [NavigationApp.Apple]: 'http://maps.apple.com/?daddr=',
    [NavigationApp.Google]: 'https://www.google.com/maps/place/',
    [NavigationApp.Waze]: 'https://waze.com/ul?navigate=yes&ll=',
  };
  const url = lat !== null && lon !== null ? `${mapUrl[navigationApp]}${lat},${lon}` : undefined;
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

/** The legacy ParticipatingOrgChips, from a summary: each unit with its active count. */
export const ListedUnitChips = observer(function ListedUnitChips({ item, ...boxProps }: BoxProps & { item: ActivityListItem }) {
  return (
    <Box {...boxProps}>
      {item.units.map((unit) => (
        <Chip key={unit.id} size="small" sx={{ mr: 1 }} label={`${unit.rosterName ?? unit.title} ${unit.activeCount || ''}`} color={unitChipColor(unit.status)} variant="outlined" />
      ))}
    </Box>
  );
});
