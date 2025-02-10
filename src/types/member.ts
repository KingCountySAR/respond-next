import { Participant } from './activity';
import { UserInfo } from './userInfo';

export interface Member {
  id: string;
  orgId: string;
  name: string;
  email?: string;
  domain?: string;
}

export const buildMemberFromParticipant = (participant: Participant) => {
  return {
    id: participant.id,
    orgId: participant.organizationId,
    name: `${participant.firstname} ${participant.lastname}`,
  };
};

export const buildMemberFromUserInfo = (userInfo: UserInfo) => {
  return {
    id: userInfo.participantId,
    orgId: userInfo.organizationId,
    name: `${userInfo.given_name} ${userInfo.family_name}`,
  };
};
