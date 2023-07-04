import { Chip } from '@mui/material';
import { Activity, OrganizationStatus, ParticipatingOrg, isActive as isResponderStatusActive } from '@respond/types/activity';

function getOrgResponderCount(activity: Activity, org: ParticipatingOrg) {
  let count = Object.values(activity.participants).filter(p => isResponderStatusActive(p.timeline[0].status) && p.organizationId === org.id).length;
  return count ? count : '';
}

export const OrganizationChip = ({ org, activity }: { org: ParticipatingOrg, activity: Activity }) => {

  const responderCount = getOrgResponderCount(activity, org);

  const status = org.timeline[0]?.status;
  const color = (status === OrganizationStatus.Responding) ? 'success' :
                  (status === OrganizationStatus.Standby) ? 'warning' : 'default';

  return (
      <Chip size="small" sx={{mr: 1}} label={`${org.rosterName ?? org.title} ${responderCount}`} color={color} variant="outlined" />
  );

}