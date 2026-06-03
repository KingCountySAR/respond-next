import { Breadcrumbs, Paper, Typography } from '@mui/material';
import { DataGrid, GridColDef, GridToolbarContainer, GridToolbarFilterButton } from '@mui/x-data-grid';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { apiFetch } from '@respond/lib/api';
import { getActivityPath } from '@respond/lib/client/store/activities';
import { Activity, ActivityType } from '@respond/types/activity';

import { RelativeTimeText } from '../RelativeTimeText';

function GridToolbar() {
  return (
    <GridToolbarContainer>
      <GridToolbarFilterButton />
    </GridToolbarContainer>
  );
}

const columns: GridColDef[] = [
  { field: 'idNumber', headerName: 'DEM #', width: 150 },
  { field: 'title', headerName: 'Title', width: 450, renderCell: (params) => <Link href={getActivityPath(params.row)}>{params.row.title}</Link> },
  {
    field: 'startTime',
    headerName: 'Start Time',
    width: 200,
    renderCell: (params) => <RelativeTimeText time={params.row.startTime}></RelativeTimeText>,
  },
];

const paginationModel = { page: 0, pageSize: 15 };

function ActivityList({ activities, loading }: { activities: Activity[]; loading: boolean }) {
  return (
    <DataGrid
      rows={activities}
      columns={columns}
      loading={loading}
      initialState={{ pagination: { paginationModel } }}
      pageSizeOptions={[15, 25, 50]}
      density="compact"
      autoHeight
      slots={{ toolbar: GridToolbar }}
      sx={
        loading
          ? {
              '--unstable_DataGrid-overlayBackground': (theme) => theme.palette.background.paper,
              backgroundColor: 'background.paper',
              '& .MuiDataGrid-virtualScroller, & .MuiDataGrid-overlayWrapper, & .MuiDataGrid-overlayWrapperInner, & .MuiDataGrid-overlay': {
                backgroundColor: 'background.paper',
              },
            }
          : undefined
      }
    />
  );
}

export function ActivityListPage({ activityType }: { activityType: ActivityType }) {
  const isMissions = activityType === 'missions';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadActivities() {
      setLoading(true);
      try {
        const response = await apiFetch<{ data?: Activity[] }>(`/api/v1/${activityType}`);
        if (!cancelled) {
          setActivities(response.data ?? []);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadActivities();

    return () => {
      cancelled = true;
    };
  }, [activityType]);

  const sortedActivities = [...activities].sort((a, b) => (a.startTime === b.startTime ? (a.title < b.title ? -1 : 1) : a.startTime < b.startTime ? 1 : -1));

  const pageTitle = isMissions ? 'Mission List' : 'Event List';
  document.title = pageTitle;

  return (
    <ToolbarPage>
      <Paper sx={{ p: 2 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link href="/">Home</Link>
          <Typography color="text.primary">{pageTitle}</Typography>
        </Breadcrumbs>
        <ActivityList activities={sortedActivities} loading={loading} />
      </Paper>
    </ToolbarPage>
  );
}
