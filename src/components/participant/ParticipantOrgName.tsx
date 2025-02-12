import { getOrganizationName } from '@respond/types/activity';

import { useActivityContext } from '../activities/ActivityProvider';

import { useParticipantContext } from './ParticipantProvider';

export function ParticipantOrgName() {
  const activity = useActivityContext();
  const participant = useParticipantContext();
  return <>{getOrganizationName(activity, participant.organizationId)}</>;
}
