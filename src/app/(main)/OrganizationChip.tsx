import { Chip } from '@mui/material';
import { OrganizationStatus, ParticipatingOrg } from '@respond/types/activity';

export const OrganizationChip = ({ org }: { org: ParticipatingOrg }) => {

  const status = org.timeline[0]?.status;
  const color = (status === OrganizationStatus.Responding) ? 'success' :
                  (status === OrganizationStatus.Standby) ? 'warning' : 'default';

  return (
      <Chip size="small" sx={{mr: 1}} label={org.rosterName ?? org.title} color={color} variant="outlined" />
  );

}