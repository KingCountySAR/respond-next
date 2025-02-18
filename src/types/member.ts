import { Participant } from './activity';
import { UserInfo } from './userInfo';

export type MemberIdType = string | number;

export interface Member {
  id: MemberIdType;
  orgId: string;
  name?: string;
  email?: string;
  phone?: string;
}

export const stubMemberFromParticipant = (participant: Participant) => {
  return {
    id: participant.id,
    orgId: participant.timeline[0]?.organizationId ?? participant.organizationId,
    name: `${participant.firstname} ${participant.lastname}`,
  };
};

export const stubMemberFromUserInfo = (userInfo: UserInfo) => {
  return {
    id: userInfo.participantId,
    orgId: userInfo.organizationId,
    name: `${userInfo.given_name} ${userInfo.family_name}`,
  };
};
