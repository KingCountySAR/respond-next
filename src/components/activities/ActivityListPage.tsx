import { Box, Breadcrumbs, Typography } from '@mui/material';
import Link from 'next/link';

import { RelativeTimeText } from '@respond/components/RelativeTimeText';
import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivityTypeSelector, getActivityPath } from '@respond/lib/client/store/activities';
import { Activity, ActivityType } from '@respond/types/activity';

function ActivityList({ activities }: { activities: Activity[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>DEM #</th>
          <th style={{ textAlign: 'left' }}>Title</th>
          <th style={{ textAlign: 'left' }}>Start Time</th>
        </tr>
      </thead>
      <tbody>
        {activities.map((a) => (
          <tr key={a.id}>
            <td style={{ paddingRight: '1em' }}>{a.idNumber}</td>
            <td style={{ paddingRight: '1em' }}>
              <Link href={getActivityPath(a)}>{a.title}</Link>
            </td>
            <td>
              <RelativeTimeText time={a.startTime}></RelativeTimeText>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ActivityListPage({ activityType }: { activityType: ActivityType }) {
  const isMissions = activityType === 'missions';

  let activities = useAppSelector(buildActivityTypeSelector(isMissions));
  activities = activities.sort((a, b) => (a.startTime === b.startTime ? (a.title < b.title ? -1 : 1) : a.startTime < b.startTime ? 1 : -1));

  const pageTitle = isMissions ? 'Mission List' : 'Event List';
  document.title = pageTitle;

  return (
    <ToolbarPage>
      <main>
        <Box sx={{ pb: 4 }}>
          <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
            <Link href="/">Home</Link>
            <Typography color="text.primary">{pageTitle}</Typography>
          </Breadcrumbs>
          <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5">{pageTitle}</Typography>
          </Box>
          <ActivityList activities={activities} />
        </Box>
      </main>
    </ToolbarPage>
  );
}
