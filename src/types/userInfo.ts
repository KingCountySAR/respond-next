import { DefaultSession } from 'next-auth';

/** User information exposed to clients */
export type UserInfo = {
  email: string;
  userId: string;
  organizationId: string;
  participantId: string;
  domain: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
} & DefaultSession['user'];
