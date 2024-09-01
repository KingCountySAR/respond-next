import { NearMe } from '@mui/icons-material';
import { Box, Card, CardActionArea, CardActions, Grid, IconButton, Typography } from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createContext, ReactNode, useContext } from 'react';

import { StatusChip } from '@respond/components/StatusChip';
import { StatusUpdater } from '@respond/components/StatusUpdater';
import { useAppSelector } from '@respond/lib/client/store';
import { getActiveParticipants, getActivityPath, getActivityStatus, isActive, isFuture } from '@respond/lib/client/store/activities';
import { NavigationApp } from '@respond/lib/client/store/preferences';
import { Activity, ParticipantStatus } from '@respond/types/activity';

import { OrganizationChip } from '../OrganizationChip';
import { OutputForm, OutputText, OutputTime } from '../OutputForm';
import { RelativeStyle } from '../RelativeTimeText';

type ActivityTileContextProps = {
  activity: Activity;
  status: ParticipantStatus | undefined;
};

const ActivityTileContext = createContext<ActivityTileContextProps | null>(null);

function useActivityTileContext() {
  const context = useContext(ActivityTileContext);
  if (!context) throw new Error('ActivityTile compound components must be rendered within ActivityTile');
  return context;
}

function ActivityTile({ activity, status, children }: { activity: Activity; status?: ParticipantStatus; children?: ReactNode }) {
  const router = useRouter();
  const handleClick = () => {
    router.push(getActivityPath(activity));
  };
  return (
    <ActivityTileContext.Provider value={{ activity, status }}>
      <Card>
        <CardActionArea sx={{ p: 1 }} onClick={handleClick}>
          <Header />
          <OutputForm>{children}</OutputForm>
          <Organizations />
        </CardActionArea>
        <Footer>
          <StatusUpdater activity={activity} />
        </Footer>
      </Card>
    </ActivityTileContext.Provider>
  );
}

function Header() {
  const { activity, status } = useActivityTileContext();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'row' }} alignItems="top">
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h6" lineHeight={1}>
          {activity.title}
        </Typography>
        <Typography color={'text.secondary'}>{activity.idNumber}</Typography>
      </Box>
      {status && <StatusChip status={status} />}
    </Box>
  );
}

function Organizations() {
  const { activity } = useActivityTileContext();
  return (
    <>
      {activity.isMission && (
        <Box sx={{ pt: 2 }}>
          {Object.entries(activity.organizations ?? {}).map(([id, org]) => (
            <OrganizationChip key={id} org={org} activity={activity} />
          ))}
        </Box>
      )}
    </>
  );
}

function Footer({ children }: { children: ReactNode }) {
  const { activity } = useActivityTileContext();
  return (
    <>
      {isActive(activity) && (
        <CardActions>
          <Grid container justifyContent="space-between" alignItems="center">
            <Grid item>
              <SartopoButton />
              <NavigationButton />
            </Grid>
            <Grid item>{children}</Grid>
          </Grid>
        </CardActions>
      )}
    </>
  );
}

function SartopoButton() {
  const { activity } = useActivityTileContext();
  return (
    <>
      {activity.mapId && (
        <IconButton aria-label="Map" href={`https://sartopo.com/m/${activity.mapId}`} target="_blank">
          <Image src="/sartopo-logo.svg" alt="SARTopo Logo" width={25} height={25} />
        </IconButton>
      )}
    </>
  );
}

function NavigationButton() {
  const { activity } = useActivityTileContext();
  const navApp: NavigationApp = useAppSelector((state) => state.preferences.navigationApp);
  const mapUrl = {
    [NavigationApp.Apple]: 'http://maps.apple.com/?daddr=',
    [NavigationApp.Google]: 'https://www.google.com/maps/place/',
    [NavigationApp.Waze]: 'https://waze.com/ul?navigate=yes&ll=',
  };
  const { lat, lon } = activity.location;
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
}

function ActivityStatus() {
  const { activity } = useActivityTileContext();
  return <OutputText label="Status" value={getActivityStatus(activity)} />;
}

function ActivityLocation() {
  const { activity } = useActivityTileContext();
  return <OutputText label="Location" value={activity.location.title} />;
}

function ActivityResponders() {
  const { activity } = useActivityTileContext();
  return <OutputText label="Responders" value={getActiveParticipants(activity).length.toString()} />;
}

function ActivityStartTime() {
  const { activity } = useActivityTileContext();
  return <>{isFuture(activity.startTime) && <OutputTime label="Start Time" time={activity.startTime} relative={RelativeStyle.Auto}></OutputTime>}</>;
}

ActivityTile.Status = ActivityStatus;
ActivityTile.StartTime = ActivityStartTime;
ActivityTile.Location = ActivityLocation;
ActivityTile.Responders = ActivityResponders;

export { ActivityTile };
