import { Chip } from '@mui/material';
import { BoxProps } from '@mui/material/Box';

import { Box } from '@respond/components/Material';
import { isActive, OrganizationStatus, ParticipatingOrg } from '@respond/types/activity';

import { useActivityContext } from './ActivityProvider';

export function ParticipatingOrgChips({ filter, setFilter, ...boxProps }: BoxProps & { filter?: string; setFilter?: (value: string) => void }) {
  const activity = useActivityContext();

  const onClick = (id: string) => (setFilter ? () => setFilter(filter === id ? '' : id) : undefined);

  const getParticipantCount = (org: ParticipatingOrg) => {
    return Object.values(activity.participants).filter((p) => isActive(p.timeline[0].status) && p.organizationId === org.id).length;
  };

  const getLabel = (org: ParticipatingOrg) => {
    return `${org.rosterName ?? org.title} ${getParticipantCount(org) || ''}`;
  };

  return (
    <Box {...boxProps}>
      {Object.entries(activity.organizations ?? {}).map(([id, org]) => (
        <OrganizationChip key={id} label={getLabel(org)} status={org.timeline[0]?.status} selected={filter === id} onClick={onClick?.(id)} />
      ))}
    </Box>
  );
}

function OrganizationChip({ label, status, selected, onClick }: { label: string; status: OrganizationStatus; selected: boolean; onClick?: () => void }) {
  const color = status === OrganizationStatus.Responding ? 'success' : status === OrganizationStatus.Standby ? 'warning' : 'default';
  return <Chip size="small" sx={{ mr: 1 }} label={label} color={color} variant={selected ? 'filled' : 'outlined'} onClick={onClick} />;
}
