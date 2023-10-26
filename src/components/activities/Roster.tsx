import { DataGrid, GridColDef, GridEventListener, GridRowsProp } from '@mui/x-data-grid';
import formatDate from 'date-fns/format';

import { STATUS_TEXT } from '@respond/components/StatusChip';
import { Participant, ParticipantStatus, ParticipatingOrg } from '@respond/types/activity';

import styles from './ActivityPage.module.css';

export const Roster = ({ participants, orgs, orgFilter, startTime }: { participants: Record<string, Participant>; orgs: Record<string, ParticipatingOrg>; orgFilter: string; startTime: number }) => {
  const _startTime = startTime;
  const handleRowClick: GridEventListener<'rowClick'> = (
    _params, // GridRowParams
    _event, // MuiEvent<React.MouseEvent<HTMLElement>>
    _details, // GridCallbackDetails
  ) => {
    console.log('handle row click');
  };

  const rows: GridRowsProp = Object.values(participants)
    .filter((f) => f.timeline[0].status !== ParticipantStatus.NotResponding)
    .filter((f) => (orgFilter ? f.organizationId == orgFilter : true))
    .map((f) => ({
      ...f,
      orgName: orgs[f.organizationId]?.rosterName ?? orgs[f.organizationId]?.title,
      fullName: f.lastname + ', ' + f.firstname,
      statusColor: f.timeline[0].status,
      statusDescription: STATUS_TEXT[f.timeline[0].status],
      time: f.timeline[0].time,
    }));

  const columns: GridColDef[] = [
    {
      field: 'statusColor',
      headerName: '',
      width: 10,
      minWidth: 15,
      valueFormatter: () => '',
      disableColumnMenu: true,
      cellClassName: ({ value }: { value?: ParticipantStatus }) => `roster-status roster-status-${ParticipantStatus[value!]}`,
    },
    {
      field: 'fullName',
      headerName: 'Name',
      minWidth: 15,
      flex: 1,
      cellClassName: styles.rosterNameCell,
    },
    {
      field: 'orgName',
      headerName: 'Org',
      flex: 1,
      renderCell: (o) => {
        return (
          <div>
            <div>{o.value}</div>
            <div style={{ fontSize: '80%' }}>{o.row.tags?.join(', ')}</div>
          </div>
        );
      },
    },
    { field: 'statusDescription', headerName: 'Status', minWidth: 15, flex: 1 },
    {
      field: 'time',
      headerName: 'Time',
      valueFormatter: (o) => {
        const isToday = new Date().setHours(0, 0, 0, 0) === new Date(o.value).setHours(0, 0, 0, 0);
        return `${!isToday ? formatDate(o.value, 'yyyy-MM-dd ') : ''}${formatDate(o.value, 'HHmm')}`;
      },
      flex: 1,
    },
  ];

  return <DataGrid className={styles.roster} rows={rows} columns={columns} autoHeight disableRowSelectionOnClick hideFooter rowSelection={false} onRowClick={handleRowClick} getRowHeight={() => 'auto'} />;
};
