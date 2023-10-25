import { Chip } from '@mui/material';
import { MouseEventHandler } from 'react';

import { Activity, isActive as isParticipantStatusActive, OrganizationStatus, ParticipatingOrg } from '@respond/types/activity';

function getOrgParticipantCount(activity: Activity, org: ParticipatingOrg) {
  const count = Object.values(activity.participants).filter((p) => isParticipantStatusActive(p.timeline[0].status) && p.organizationId === org.id).length;
  return count ? count : '';
}

export const OrganizationChip = ({ org, activity, selected = false, onClick = undefined }: { org: ParticipatingOrg; activity: Activity; selected?: boolean; onClick?: MouseEventHandler<HTMLDivElement> }) => {
  const participantCount = getOrgParticipantCount(activity, org);

  const status = org.timeline[0]?.status;
  const color = status === OrganizationStatus.Responding ? 'success' : status === OrganizationStatus.Standby ? 'warning' : 'default';

  return <Chip size="small" sx={{ mr: 1 }} label={`${org.rosterName ?? org.title} ${participantCount}`} color={color} variant={selected ? 'filled' : 'outlined'} onClick={onClick} />;
};
