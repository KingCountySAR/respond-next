import { Breadcrumbs, Paper, Typography } from '@mui/material';
import { DataGrid, GridColDef, GridToolbarContainer, GridToolbarFilterButton } from '@mui/x-data-grid';
import Link from 'next/link';

import { ToolbarPage } from '@respond/components/ToolbarPage';
import { useAppSelector } from '@respond/lib/client/store';
import { buildActivityTypeSelector, getActivityPath } from '@respond/lib/client/store/activities';
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

function ActivityList({ activities }: { activities: Activity[] }) {
  return <DataGrid rows={activities} columns={columns} initialState={{ pagination: { paginationModel } }} pageSizeOptions={[15, 25, 50]} density="compact" autoHeight slots={{ toolbar: GridToolbar }} />;
}

export function ActivityListPage({ activityType }: { activityType: ActivityType }) {
  const isMissions = activityType === 'missions';

  let activities = useAppSelector(buildActivityTypeSelector(isMissions));
  activities = activities.sort((a, b) => (a.startTime === b.startTime ? (a.title < b.title ? -1 : 1) : a.startTime < b.startTime ? 1 : -1));

  const pageTitle = isMissions ? 'Mission List' : 'Event List';
  document.title = pageTitle;

  return (
    <ToolbarPage>
      <Paper sx={{ p: 2 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link href="/">Home</Link>
          <Typography color="text.primary">{pageTitle}</Typography>
        </Breadcrumbs>
        <ActivityList activities={activities} />
      </Paper>
    </ToolbarPage>
  );
}
