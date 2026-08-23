import { Box, Button, Stack, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo } from 'react';
import { useStore } from 'react-redux';
import { Link } from 'wouter';

import { useClock, useOrganizationDomainModel, useUserDomainModel } from '@respond/components/AppDomainProvider';
import { OutputForm, OutputText, OutputTime } from '@respond/components/OutputForm';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import type { AppStore } from '@respond/lib/client/store';

import { ActivityListDomainModel } from '@/client/models/activityListDomainModel';
import { HomeViewModel } from '@/client/pages/respond/homeViewModel';

import { ActivityStack } from './components/ActivityStack';
import { ActivityTile } from './components/ActivityTile';

// Owns the activity-list domain model's lifecycle: build it from the store and
// subscribe/unsubscribe across mount. Kept off the app-wide provider since Home is
// the only consumer — a thin wrapper here is enough. The observing content lives in
// HomeContent so only that subtree re-renders as the read model changes.
export function Home() {
  const store = useStore() as AppStore;
  const clock = useClock();
  const list = useMemo(() => new ActivityListDomainModel(store, clock), [store, clock]);

  useEffect(() => {
    list.connect();
    return () => list.dispose();
  }, [list]);

  return <HomeContent domain={list} />;
}

const HomeContent = observer(function HomeContent({ domain }: { domain: ActivityListDomainModel }) {
  const user = useUserDomainModel();
  const organization = useOrganizationDomainModel();
  const clock = useClock();
  const activities = useMemo(() => new HomeViewModel(domain, user, organization, clock), [domain, user, organization, clock]);

  useEffect(() => {
    document.title = 'Event list';
  }, []);

  return (
    <ToolbarPage>
      <main>
        {activities.myCurrentActivities.length < 1 ? null : (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ mb: 1 }}>
              <Typography variant="h5">My Activity</Typography>
            </Box>
            <Stack spacing={1}>
              {activities.myCurrentActivities.map((up) => (
                <ActivityTile key={up.activity.id} activity={up.activity} status={up.participant.status}>
                  <OutputForm>
                    <Box>
                      <OutputText label="Location" value={up.activity.location.title} />
                    </Box>
                    <Box>
                      <OutputText label="Mission Status" value={up.activity.statusText} />
                      {up.activity.startsInFuture && <OutputTime label="Start Time" time={up.activity.startTime}></OutputTime>}
                    </Box>
                  </OutputForm>
                </ActivityTile>
              ))}
            </Stack>
          </Box>
        )}
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              mb: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h5">Missions</Typography>
            {activities.canCreateMissions && (
              <Button variant="outlined" component={Link} href="~/mission/new">
                New Mission
              </Button>
            )}
          </Box>
          <ActivityStack type="missions" activities={activities.missions} statusMap={activities.statusMap} showOrgs />
        </Box>
        <Box sx={{ pb: 4 }}>
          <Box
            sx={{
              mb: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h5">Events</Typography>
            {activities.canCreateEvents && (
              <Button variant="outlined" component={Link} href="~/event/new">
                New Event
              </Button>
            )}
          </Box>
          <ActivityStack type="events" activities={activities.events} statusMap={activities.statusMap} />
        </Box>
      </main>
    </ToolbarPage>
  );
});
