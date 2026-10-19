/**
 * Organizations as the server stores them and the admin page edits them. They form a tree (an
 * umbrella organization over its units). Each site is one organization, found by the request's
 * hostname; its brand and member provider are its own or the nearest ancestor's.
 */
import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase letters, digits and dashes');
const email = z.string().trim().toLowerCase().email();
// A bare hostname, no port or scheme; `localhost` and `*.localhost` work for development.
const hostname = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/, 'a hostname, like crt.example.org');

export const Brand = z.object({
  primary: z.string().trim().min(1),
  primaryDark: z.string().trim().min(1).optional(),
  /** The app icon: a `data:image/...` URI or an `https://` URL, ideally square and 512px. */
  icon: z
    .string()
    .regex(/^(data:image\/[a-z0-9.+-]+;base64,|https:\/\/)/i, 'a data:image URI or an https URL')
    .optional(),
});
export type Brand = z.infer<typeof Brand>;

export const OrganizationPartner = z.object({
  id,
  canCreateMissions: z.boolean().default(false),
  canCreateEvents: z.boolean().default(false),
});
export type OrganizationPartner = z.infer<typeof OrganizationPartner>;

/** Group title (in the member provider) to tag label, e.g. "CRT Medical" to "MED". */
export const TagRules = z.record(z.string().trim().min(1)).default({});
export type TagRules = z.infer<typeof TagRules>;

export const Organization = z.object({
  id,
  /** The organization above this one, e.g. the umbrella over a unit. */
  parentId: id.nullable().default(null),
  title: z.string().trim().min(1),
  /** What rosters and chips show ("CRT"). */
  shortTitle: z.string().trim().min(1),
  /** The hostnames that serve this organization's site. */
  hostnames: z.array(hostname).default([]),
  /** The email domains of this organization's people; signing in with one uses its member provider. */
  emailDomains: z.array(hostname).default([]),
  /** Unset: the parent's. */
  brand: Brand.optional(),
  /** A member provider's id. Unset: the nearest ancestor's. */
  memberProvider: id.nullable().default(null),
  /** This organization's name in its provider (cedar's unit title), to keep searches to its members. */
  providerUnit: z.string().trim().min(1).nullable().default(null),
  /**
   * The tags this organization's members get from their groups: those of its unit in the provider,
   * or everyone in the provider when it has no unit.
   */
  memberTags: TagRules,
  canCreateMissions: z.boolean().default(false),
  canCreateEvents: z.boolean().default(false),
  /**
   * The other organizations this one may create activities for. Those under it have them too; their
   * own entry for the same partner replaces this one.
   */
  partners: z.array(OrganizationPartner).default([]),
  /** Who may change this organization's settings. */
  admins: z.array(email).default([]),
});
export type Organization = z.infer<typeof Organization>;

/** What an organization's own admins may change; the rest is the site admins'. */
export const ORG_ADMIN_FIELDS = ['title', 'shortTitle', 'brand', 'memberTags', 'canCreateMissions', 'canCreateEvents', 'partners', 'admins'] as const satisfies readonly (keyof Organization)[];

const memberSeed = z.tuple([z.string(), z.string()]).rest(z.string());

export const MemberProviderConfig = z.discriminatedUnion('kind', [
  z.object({
    id,
    kind: z.literal('cedar'),
    /** cedar's base URL. */
    url: z.string().url(),
    /** Hydra's token endpoint, `<issuer>/oauth2/token`. */
    tokenUrl: z.string().url(),
    clientId: z.string().min(1),
    /**
     * Write-only: the server stores it encrypted and never sends it back. Left out when saving, the
     * stored one is kept.
     */
    clientSecret: z.string().min(1).optional(),
    scope: z.string().optional(),
  }),
  z.object({
    id,
    kind: z.literal('fixture'),
    /** Fictional members by unit name: `[given, family, ...groups]`, with emails at the unit's domain. */
    units: z.record(z.object({ emailDomain: hostname, members: z.array(memberSeed) })).default({}),
  }),
]);
export type MemberProviderConfig = z.infer<typeof MemberProviderConfig>;

/** A member provider as admins see it: never the secret, only whether there is one. */
export type MemberProviderView = MemberProviderConfig & { hasClientSecret?: boolean };

/** `GET /api/admin/member-providers` (site admins). */
export interface AdminMemberProvidersResponse {
  memberProviders: MemberProviderView[];
  /** The organizations that name each provider. */
  usedBy: Record<string, string[]>;
}

/** The seed file: providers, organizations and site admins to start from. */
export const OrganizationSeed = z.object({
  memberProviders: z.array(MemberProviderConfig).default([]),
  organizations: z.array(Organization).default([]),
  siteAdmins: z.array(email).default([]),
});
export type OrganizationSeed = z.infer<typeof OrganizationSeed>;

/** `GET /api/admin/organizations`: the organizations the signed-in person may edit. */
export interface AdminOrganizationsResponse {
  organizations: Organization[];
  /** Every organization's id and name, for parents and partners. */
  all: { id: string; title: string }[];
  memberProviders: string[];
  siteAdmin: boolean;
}

/** `GET /api/admin/site-admins`. Those from the environment can't be removed here. */
export interface SiteAdminsResponse {
  fromEnvironment: string[];
  stored: string[];
}
