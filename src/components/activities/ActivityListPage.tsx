import { Box, Breadcrumbs, Typography } from '@mui/material';
import { format as formatDate } from 'date-fns';
import Link from 'next/link';
import * as React from 'react';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { apiFetch } from '@respond/lib/api';
import { getActivityPath } from '@respond/lib/client/store/activities';
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
            <td>{formatDate(a.startTime, 'yyyy-MM-dd EEE HHmm')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ActivityListPage({ activityType }: { activityType: ActivityType }) {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [activities, setActivities] = React.useState<Activity[]>([]);

  const pageTitle = activityType === 'missions' ? 'Mission List' : 'Event List';

  React.useEffect(() => {
    document.title = pageTitle;
    apiFetch<{ data: Activity[] }>(`/api/v1/${activityType}`).then((api) => {
      setLoading(false);
      setActivities(api.data.sort((a, b) => (a.startTime === b.startTime ? (a.title < b.title ? -1 : 1) : a.startTime < b.startTime ? 1 : -1)));
    });
  }, [activityType, pageTitle]);

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
          {loading ? <Typography>Loading ...</Typography> : <ActivityList activities={activities} />}
        </Box>
      </main>
    </ToolbarPage>
  );
}
