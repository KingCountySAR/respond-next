export const ORGS_COLLECTION = 'organizations';

export interface OrganizationPartner {
  id: string;
  title: string;
  rosterName?: string;
  canCreateEvents: boolean;
  canCreateMissions: boolean;
}

export interface WhitelistLoginProvider {
  type: 'whitelist';
  list: string[];
}
export interface MembershipLoginProvider {
  type: 'membership';
}
export type LoginProvider = WhitelistLoginProvider | MembershipLoginProvider;

export interface OrganizationDoc {
  id: string;
  domain: string;
  title: string;
  rosterName?: string;
  mouName?: string;
  brand: {
    primary: string;
    primaryDark?: string;
    faviconUrl?: string;
    homeScreenIconUrl?: string;
  };
  memberProvider: string;
  loginProviders: LoginProvider[];
  canCreateEvents: boolean;
  canCreateMissions: boolean;
  supportEmail?: string;
  partners: OrganizationPartner[];
  tags?: {
    groupId: string;
    label: string;
  }[];
}
