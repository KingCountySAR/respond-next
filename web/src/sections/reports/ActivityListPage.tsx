import { Alert, Breadcrumbs, Paper, Typography } from '@mui/material';
import { DataGrid, GridToolbarContainer, GridToolbarFilterButton, type GridColDef } from '@mui/x-data-grid';
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import type { ActivitySummary } from '@sync/domain';
import { observer, useActivityList } from '@sync/model/react';
import { useApi } from '../../shell/api';
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

const toRow = ({ id, activity: a }: ActivitySummary): Row => ({ id, isMission: a.kind === 'mission', idNumber: a.idNumber, title: a.title, startTime: a.startTime });

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

/**
 * The legacy Mission List / Event List: every activity of the type. The archive (`GET /api/activities`),
 * read once, has those closed long ago too; the live list keeps open and recent ones up to date.
 */
export const ActivityListPage = observer(function ActivityListPage({ activityType }: { activityType: ActivityListType }) {
  const api = useApi();
  const list = useActivityList(useSyncClient());
  const [summaries, setSummaries] = useState<ActivitySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMissions = activityType === 'missions';
  const pageTitle = isMissions ? 'Mission List' : 'Event List';

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  useEffect(() => {
    let current = true;
    api.activities().then(
      (data) => current && setSummaries(data),
      (err: unknown) => current && setError(err instanceof Error ? err.message : String(err)),
    );
    return () => {
      current = false;
    };
  }, [api]);

  const byId = new Map((summaries ?? []).map((s) => [s.id, s]));
  for (const item of list?.activities ?? []) if (item.record) byId.set(item.id, item.record);
  const rows = [...byId.values()]
    .map(toRow)
    .filter((r) => r.isMission === isMissions)
    .sort(byStartDescending);

  return (
    <ToolbarPage>
      <Paper sx={{ p: 2 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link href="~/">Home</Link>
          <Typography sx={{ color: 'text.primary' }}>{pageTitle}</Typography>
        </Breadcrumbs>
        {error ? <Alert severity="error">Couldn't load the list: {error}</Alert> : <ActivityGrid rows={rows} loading={!summaries || !list} />}
      </Paper>
    </ToolbarPage>
  );
});
