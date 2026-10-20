/** A unit that may own activities, with which kinds it may create. */
export interface SiteUnit {
  id: string;
  title: string;
  /** The short name rosters and chips show ("CRT"). */
  shortTitle: string;
  canCreateMissions: boolean;
  canCreateEvents: boolean;
}

/** What every client loads before anything else (`GET /api/bootstrap`): the site's name and colors. */
export interface SiteConfig {
  /**
   * The site's organization. Its people respond under it as their unit, as in the legacy app. Its
   * partners are the other units it may create activities for.
   */
  organization: SiteUnit & { partners: SiteUnit[] };
  theme: { primary: string; primaryDark?: string };
  /** The dev sign-in is on (DEV_TOOLS): anyone may sign in as any email, and choose their tier. */
  devSignIn: boolean;
  /** Sign-in with Google, through the site's sign-in provider (`/api/auth/login`). */
  googleSignIn: boolean;
  buildId: string;
}

export interface BootstrapResponse {
  config: SiteConfig;
}

const permission = (missions: boolean) => (missions ? 'canCreateMissions' : 'canCreateEvents');

/** The units that may own a new mission (or event): the organization first, then its partners. */
export function ownerOptions(org: SiteConfig['organization'], missions: boolean): SiteUnit[] {
  const can = permission(missions);
  return [...(org[can] ? [org] : []), ...org.partners.filter((p) => p[can])];
}

/** Whether the site may create missions (or events) at all, for itself or a partner. */
export const canCreate = (org: SiteConfig['organization'], missions: boolean): boolean => ownerOptions(org, missions).length > 0;
