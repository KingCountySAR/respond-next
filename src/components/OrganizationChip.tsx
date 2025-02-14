import { Chip } from '@mui/material';

import { isActive as isParticipantStatusActive, OrganizationStatus, ParticipatingOrg } from '@respond/types/activity';

import { useActivityContext } from './activities/ActivityProvider';

export const OrganizationChip = ({ org, selected, onClick }: { org: ParticipatingOrg; selected?: boolean; onClick?: () => void }) => {
  const activity = useActivityContext();

  const count = Object.values(activity.participants).filter((p) => isParticipantStatusActive(p.timeline[0].status) && p.organizationId === org.id).length || '';

  const status = org.timeline[0]?.status;
  const color = status === OrganizationStatus.Responding ? 'success' : status === OrganizationStatus.Standby ? 'warning' : 'default';
  const variant = selected ? 'filled' : 'outlined';

  return <Chip size="small" sx={{ mr: 1 }} label={`${org.rosterName ?? org.title} ${count}`} color={color} variant={variant} onClick={onClick} />;
};
