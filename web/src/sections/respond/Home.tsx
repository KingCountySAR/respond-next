import { Box, Button, Stack, Typography } from '@mui/material';
import { useEffect } from 'react';
import { Link } from 'wouter';
import { canCreate, isActiveStatus, participantIdFor, type ParticipantStatus } from '@sync/domain';
import type { ActivityList, ActivityListItem } from '@sync/model';
import { observer, useActivityList } from '@sync/model/react';
import { useSite } from '../../shell/App';
import { useAuth } from '../../shell/auth';
import { useSyncClient } from '../../shell/sync';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { OutputForm, OutputText, OutputTime } from '../../ui/OutputForm';
import { phaseText } from '../../ui/status';
import { ActivityStack } from './components/ActivityStack';
import { ActivityTile } from './components/ActivityTile';

const MAX_COMPLETED_VISIBLE = 3;
const COMPLETED_VISIBLE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// Most recent first: missions sort by start time descending, other activities ascending.
function byRecency(a: ActivityListItem, b: ActivityListItem) {
  const sign = a.isMission ? -1 : 1;
  const at = a.activity!.startTime;
  const bt = b.activity!.startTime;
  return at === bt ? 0 : at > bt ? sign : -sign;
}

/** Active activities plus a bounded tail of recently closed ones, sorted for display. */
function forDisplay(items: ActivityListItem[], now: number): ActivityListItem[] {
  const oldestVisible = now - COMPLETED_VISIBLE_DAYS * DAY_MS;
  const active = items.filter((m) => m.isActive).sort(byRecency);
  const complete = items
    .filter((m) => !m.isActive && m.activity!.startTime > oldestVisible)
    .sort(byRecency)
    .slice(0, MAX_COMPLETED_VISIBLE);
  return active.concat(complete);
}

export function Home() {
  const list = useActivityList(useSyncClient());

  useEffect(() => {
    document.title = 'Event list';
  }, []);

  return <ToolbarPage>{list ? <HomeContent list={list} /> : <main>Loading…</main>}</ToolbarPage>;
}

const HomeContent = observer(function HomeContent({ list }: { list: ActivityList }) {
  const { session } = useAuth();
  // As the legacy app: when the organization (or a partner) may create that kind. Only managers may
  // create missions; members may create other events too.
  const org = useSite().organization;
  const manager = session?.tier === 'manage';
  const canCreateMissions = manager && canCreate(org, true);
  const canCreateEvents = (manager || session?.class === 'member') && canCreate(org, false);
  const me = session?.personRef ? participantIdFor(session.personRef) : undefined;

  const mine: { item: ActivityListItem; status: ParticipantStatus }[] = [];
  const statusMap: Record<string, ParticipantStatus> = {};
  for (const item of list.activities) {
    const status = me && item.statusOf(me);
    if (!status) continue;
    statusMap[item.id] = status;
    mine.push({ item, status });
  }
  // Events before missions, then by start time, as the legacy list did.
  mine.sort((a, b) => (a.item.isMission === b.item.isMission ? a.item.activity!.startTime - b.item.activity!.startTime : a.item.isMission ? 1 : -1));
  const myCurrentActivities = mine.filter((m) => isActiveStatus(m.status));
  const now = list.clock.now();
  const missions = forDisplay(
    list.activities.filter((a) => a.isMission),
    now,
  );
  const events = forDisplay(
    list.activities.filter((a) => !a.isMission),
    now,
  );

  return (
    <main>
      {myCurrentActivities.length < 1 ? null : (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ mb: 1 }}>
            <Typography variant="h5">My Activity</Typography>
          </Box>
          <Stack spacing={1}>
            {myCurrentActivities.map(({ item, status }) => (
              <ActivityTile key={item.id} item={item} status={status}>
                <OutputForm>
                  <Box>
                    <OutputText label="Location" value={item.activity!.location.title} />
                  </Box>
                  <Box>
                    <OutputText label="Mission Status" value={phaseText(item.phase)} />
                    {item.startsInFuture && <OutputTime label="Start Time" time={item.activity!.startTime}></OutputTime>}
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
          {canCreateMissions && (
            <Button variant="outlined" component={Link} href="~/mission/new">
              New Mission
            </Button>
          )}
        </Box>
        <ActivityStack type="missions" activities={missions} statusMap={statusMap} showOrgs />
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
          {canCreateEvents && (
            <Button variant="outlined" component={Link} href="~/event/new">
              New Event
            </Button>
          )}
        </Box>
        <ActivityStack type="events" activities={events} statusMap={statusMap} />
      </Box>
    </main>
  );
});
