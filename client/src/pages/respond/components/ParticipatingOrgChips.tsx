import { Chip } from '@mui/material';
import { BoxProps } from '@mui/material/Box';
import { observer } from 'mobx-react-lite';

import { Box } from '@respond/components/Material';
import { OrganizationStatus } from '@respond/shared/types/activity';

import { ActivityDomainModel } from '@/client/models/activityDomainModel';

export const ParticipatingOrgChips = observer(function ParticipatingOrgChips({
  activity,
  filter,
  setFilter,
  ...boxProps
}: BoxProps & { activity: ActivityDomainModel; filter?: string; setFilter?: (value: string) => void }) {
  const onClick = (id: string) => (setFilter ? () => setFilter(filter === id ? '' : id) : undefined);

  return (
    <Box {...boxProps}>
      {activity.organizations.map((org) => (
        <OrganizationChip key={org.id} label={`${org.name} ${org.activeParticipantCount || ''}`} status={org.status} selected={filter === org.id} onClick={onClick?.(org.id)} />
      ))}
    </Box>
  );
});

function OrganizationChip({ label, status, selected, onClick }: { label: string; status: OrganizationStatus; selected: boolean; onClick?: () => void }) {
  const color = status === OrganizationStatus.Responding ? 'success' : status === OrganizationStatus.Standby ? 'warning' : 'default';
  return <Chip size="small" sx={{ mr: 1 }} label={label} color={color} variant={selected ? 'filled' : 'outlined'} onClick={onClick} />;
}
