/** User information exposed to clients */
export interface UserInfo {
  email: string;
  userId: string;
  organizationId: string;
  participantId: string;
  domain: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};