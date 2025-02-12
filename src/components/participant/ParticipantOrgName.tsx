import { getOrganizationName } from '@respond/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';
import { Typography } from '../Material';

import { useParticipantContext } from './ParticipantProvider';

export function ParticipantOrgName({ fontWeight }: { fontWeight: number }) {
  const activity = useActivityContext();
  const participant = useParticipantContext();
  return <Typography fontWeight={fontWeight}>{getOrganizationName(activity, participant.organizationId)}</Typography>;
}
