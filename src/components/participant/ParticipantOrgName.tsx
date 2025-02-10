import { getOrganizationName } from '@respond/types/activity';

import { useActivityContext } from '../../hooks/useActivityContext';
import { useParticipantContext } from '../../hooks/useParticipantContext';

export function ParticipantOrgName() {
  const activity = useActivityContext();
  const participant = useParticipantContext();
  return <>{getOrganizationName(activity, participant.organizationId)}</>;
}
