/** What every client loads before anything else (`GET /api/bootstrap`): the site's name and colours. */
export interface SiteConfig {
  /** The site's organization. Its people respond under it as their unit, as in the legacy app. */
  organization: { id: string; title: string; shortTitle: string };
  theme: { primary: string; primaryDark?: string };
  dev: {
    /** No Google sign-in: the login panel offers the dev sign-in instead. */
    noExternalNetwork: boolean;
    buildId: string;
  };
}

export interface BootstrapResponse {
  config: SiteConfig;
}
