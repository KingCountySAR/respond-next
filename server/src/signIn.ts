/**
 * Who someone signing in is. They're looked up by email (see `MemberProviders.byEmail`), and their
 * session is on the site they signed in on, whatever organization their email belongs to.
 */
import { z } from 'zod';
import { TIERS, type Organization } from '@sync/domain';
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
  tier: z.enum(TIERS),
  class: z.enum(['member', 'external']),
});

export type SignInResult = { ok: true; session: SessionData } | { ok: false; status: 400 | 403; error: string };

interface ByEmail {
  byEmail(email: string, siteOrgId: string): Promise<MemberDetails | undefined>;
}

/**
 * The development sign-in: anyone, by email, at the tier they choose. Someone the member provider
 * doesn't know needs a name, and takes part as `adhoc:<email>`. With a person ref (and a name), they
 * are that person, without asking the provider.
 */
export async function devSignIn(members: ByEmail | undefined, site: Organization, input: unknown): Promise<SignInResult> {
  const parsed = DevSignInRequest.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, status: 400, error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid sign-in' };
  }
  const { email, name, tier, class: viewerClass } = parsed.data;
  if (parsed.data.personRef) {
    // Impersonation: be this person, whoever the directory says the email is.
    if (!name) return { ok: false, status: 400, error: 'name: needed with a person ref' };
    const { personRef } = parsed.data;
    return { ok: true, session: { userId: personRef, name, email, personRef, tier, class: viewerClass, orgId: site.id } };
  }
  const found = await members?.byEmail(email, site.id);
  if (found) {
    const { personRef, name: memberName } = found.member;
    return { ok: true, session: { userId: personRef, name: memberName, email, personRef, tier, class: viewerClass, orgId: site.id } };
  }
  if (!name) return { ok: false, status: 403, error: `${email} isn't in the member directory. Give a name to sign in as a visitor.` };
  const personRef = `adhoc:${email}`;
  return { ok: true, session: { userId: personRef, name, email, personRef, tier, class: viewerClass, orgId: site.id } };
}
