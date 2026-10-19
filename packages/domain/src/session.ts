import type { ActivityViewer, Tier } from './viewer';

/** Who is signed in on this site (`GET /api/auth/session`). */
export interface Session {
  userId: string;
  name: string;
  email: string;
  /** The person this user is, e.g. `kcsara:85205`, or `adhoc:<email>` for someone the provider doesn't know. */
  personRef: string;
  /** What their groups give them, everywhere; grants from command add to it on particular missions. */
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
 * without asking the provider. Without `tier`, a member's comes from their groups, as for a real
 * sign-in; anyone else is field.
 */
export interface DevSignInRequest {
  email: string;
  name?: string;
  personRef?: string;
  tier?: Tier;
  class: ActivityViewer['class'];
}

export const viewerOfSession = (s: Pick<Session, 'userId' | 'tier' | 'class' | 'personRef'>): ActivityViewer => ({ userId: s.userId, tier: s.tier, class: s.class, personRef: s.personRef });

/** A tier someone at command gave a person on one activity, beside what their groups give them. */
export interface TierGrant {
  tier: Tier;
  /** The granter's email. */
  grantedBy: string;
  grantedAt: number;
}

/** `GET /api/activities/:activityId/grants/:personRef`. */
export interface GrantResponse {
  grant: TierGrant | null;
}

/** `PUT /api/activities/:activityId/grants/:personRef`: someone on the activity's roster gets this tier there. */
export interface GrantRequest {
  tier: 'command' | 'support';
}
