import { Breadcrumbs, Paper, Typography } from '@mui/material';
import { DataGrid, GridToolbarContainer, GridToolbarFilterButton, type GridColDef } from '@mui/x-data-grid';
import { useEffect } from 'react';
import { Link } from 'wouter';
import type { ActivityListItem } from '@sync/model';
import { observer, useActivityList } from '@sync/model/react';
import { useSyncClient } from '../../shell/sync';
import { ToolbarPage } from '../../shell/ToolbarPage';
import { RelativeTimeText } from '../../ui/RelativeTimeText';

export type ActivityListType = 'missions' | 'events';

interface Row {
  id: string;
  isMission: boolean;
  idNumber: string;
  title: string;
  startTime: number;
}

function GridToolbar() {
  return (
    <GridToolbarContainer>
      <GridToolbarFilterButton />
    </GridToolbarContainer>
  );
}

const columns: GridColDef<Row>[] = [
  { field: 'idNumber', headerName: 'DEM #', width: 150 },
  { field: 'title', headerName: 'Title', width: 450, renderCell: (params) => <Link href={`~/${params.row.isMission ? 'mission' : 'event'}/${params.row.id}`}>{params.row.title}</Link> },
  {
    field: 'startTime',
    headerName: 'Start Time',
    width: 200,
    renderCell: (params) => <RelativeTimeText time={params.row.startTime}></RelativeTimeText>,
  },
];

const paginationModel = { page: 0, pageSize: 15 };

const toRow = (item: ActivityListItem): Row | null => {
  const a = item.activity;
  return a ? { id: item.id, isMission: item.isMission, idNumber: a.idNumber, title: a.title, startTime: a.startTime } : null;
};

// Newest first, ties by title.
const byStartDescending = (a: Row, b: Row) => (a.startTime === b.startTime ? (a.title < b.title ? -1 : 1) : a.startTime < b.startTime ? 1 : -1);

function ActivityGrid({ rows, loading }: { rows: Row[]; loading: boolean }) {
  return (
    <DataGrid
      rows={rows}
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

/** The legacy Mission List / Event List, from the activity list scope: every listed activity of the type. */
export const ActivityListPage = observer(function ActivityListPage({ activityType }: { activityType: ActivityListType }) {
  const list = useActivityList(useSyncClient());
  const isMissions = activityType === 'missions';
  const pageTitle = isMissions ? 'Mission List' : 'Event List';

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  const rows = (list?.activities ?? [])
    .filter((item) => item.isMission === isMissions)
    .map(toRow)
    .filter((r): r is Row => r !== null)
    .sort(byStartDescending);

  return (
    <ToolbarPage>
      <Paper sx={{ p: 2 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link href="~/">Home</Link>
          <Typography sx={{ color: 'text.primary' }}>{pageTitle}</Typography>
        </Breadcrumbs>
        <ActivityGrid rows={rows} loading={!list} />
      </Paper>
    </ToolbarPage>
  );
});
