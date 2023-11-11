import { Chip } from '@mui/material';

import { Activity, isActive as isParticipantStatusActive, OrganizationStatus, ParticipatingOrg } from '@respond/types/activity';

function getOrgParticipantCount(activity: Activity, org: ParticipatingOrg) {
  const count = Object.values(activity.participants).filter((p) => isParticipantStatusActive(p.timeline[0].status) && p.organizationId === org.id).length;
  return count ? count : 0;
}

export const OrganizationChip = ({ org, activity, selected, onClick }: { org: ParticipatingOrg; activity: Activity; selected?: boolean; onClick?: () => void }) => {
  const participantCount = getOrgParticipantCount(activity, org);
  const participantCountText = participantCount == 0 ? '' : participantCount;

  const status = org.timeline[0]?.status;
  const color = status === OrganizationStatus.Responding ? 'success' : status === OrganizationStatus.Standby ? 'warning' : 'default';

  return <Chip size="small" sx={{ mr: 1 }} label={`${org.rosterName ?? org.title} ${participantCountText}`} color={color} variant={selected ? 'filled' : 'outlined'} onClick={onClick} />;
};
