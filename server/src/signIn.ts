/**
 * Who someone signing in is. They're looked up by email (see `MemberProviders.byEmail`), and their
 * session is on the site they signed in on, whatever organization their email belongs to. Their tier
 * is what their groups give them; grants from command add a tier on particular missions only.
 * When their grants change, their sessions are worked out again (`refreshSession`).
 */
import { z } from 'zod';
import { TIERS, highestTier, type Organization, type Tier } from '@sync/domain';
import type { GrantStore } from './grants';
import type { MemberDetails } from './members';
import type { SessionData } from './sessions';

export const DevSignInRequest = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().optional(),
  personRef: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+:\S+$/, 'a person ref, like kcsara:101')
    .optional(),
  tier: z.enum(TIERS).optional(),
  class: z.enum(['member', 'external']),
});

export type SignInResult = { ok: true; session: SessionData } | { ok: false; status: 400 | 403; error: string };

/** Where tiers come from: the member providers (groups) and the grants. */
export interface People {
  members?: {
    byEmail(email: string, siteOrgId: string): Promise<MemberDetails | undefined>;
    lookup(personRef: string): Promise<MemberDetails | undefined>;
  };
  grants?: Pick<GrantStore, 'forPerson'>;
}

/** Their tier from their groups (`fromGroups`, else looked up), and their grants. */
async function access(people: People, personRef: string, fromGroups?: Tier): Promise<Pick<SessionData, 'tier' | 'grants'>> {
  const tier = fromGroups ?? (await people.members?.lookup(personRef))?.tier ?? 'field';
  return { tier, grants: (await people.grants?.forPerson(personRef)) ?? {} };
}

/**
 * The development sign-in: anyone, by email, at the tier their groups give them or the one they
 * choose, with their grants. Someone the member provider doesn't know needs a name, and takes part
 * as `adhoc:<email>`. With a person ref (and a name), they are that person, without asking the
 * provider who the email is.
 */
export async function devSignIn(people: People, site: Organization, input: unknown): Promise<SignInResult> {
  const parsed = DevSignInRequest.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, status: 400, error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid sign-in' };
  }
  const { email, name, tier: chosen, class: viewerClass } = parsed.data;
  const sessionFor = async (personRef: string, sessionName: string, fromGroups?: Tier): Promise<SignInResult> => {
    const found = await access(people, personRef, chosen ?? fromGroups);
    return { ok: true, session: { userId: personRef, name: sessionName, email, personRef, ...found, class: viewerClass, orgId: site.id } };
  };
  // Impersonation: be this person, whoever the directory says the email is.
  if (parsed.data.personRef) return name ? sessionFor(parsed.data.personRef, name) : { ok: false, status: 400, error: 'name: needed with a person ref' };
  const found = await people.members?.byEmail(email, site.id);
  if (found) return sessionFor(found.member.personRef, found.member.name, found.tier);
  if (!name) return { ok: false, status: 403, error: `${email} isn't in the member directory. Give a name to sign in as a visitor.` };
  return sessionFor(`adhoc:${email}`, name, 'field');
}

/** Their tier on an activity: the higher of their own and any grant there. */
export function tierOn(session: Pick<SessionData, 'tier' | 'grants'>, activityId: string): Tier {
  const granted = session.grants?.[activityId];
  return granted ? highestTier([session.tier, granted]) : session.tier;
}

/** The session with its tier and grants worked out again, as now. */
export async function refreshSession(people: People, session: SessionData): Promise<SessionData> {
  const fromGroups = session.personRef.startsWith('adhoc:') ? 'field' : undefined;
  return { ...session, ...(await access(people, session.personRef, fromGroups)) };
}
