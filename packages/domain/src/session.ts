import type { ActivityViewer, Tier } from './viewer';

/** Who is signed in on this site (`GET /api/auth/session`). */
export interface Session {
  userId: string;
  name: string;
  email: string;
  /** The person this user is, e.g. `kcsara:85205`, or `adhoc:<email>` for someone the provider doesn't know. */
  personRef: string;
  tier: Tier;
  class: ActivityViewer['class'];
  /** Site admins and organization admins may open the organization admin page. */
  admin: boolean;
}

export interface SessionResponse {
  session: Session | null;
}

/**
 * The development sign-in (`POST /api/auth/dev`): who to be, by email. Someone the member provider
 * doesn't know signs in under `name` instead. `personRef` (with `name`) is someone in particular,
 * without asking the provider.
 */
export interface DevSignInRequest {
  email: string;
  name?: string;
  personRef?: string;
  tier: Tier;
  class: ActivityViewer['class'];
}

export const viewerOfSession = (s: Session): ActivityViewer => ({ userId: s.userId, tier: s.tier, class: s.class, personRef: s.personRef });
