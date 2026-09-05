import type { MyOrganization } from './organization';
import type { UserInfo } from './userInfo';

export interface SiteConfig {
  theme: { primary: string; primaryDark?: string };
  dev: { noExternalNetwork: boolean; buildId: string };
  organization: { title: string; shortTitle: string };
}

/** Everything the SPA needs at load time — replaces the old Next server-component data fetch. */
export interface BootstrapResponse {
  googleClient: string;
  config: SiteConfig;
  user?: UserInfo;
  myOrg?: MyOrganization;
  brand: { faviconUrl?: string; homeScreenIconUrl?: string };
}
