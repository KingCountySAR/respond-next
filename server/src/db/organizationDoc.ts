import { MemberProviderType } from './memberProviderType.js';

export interface MemberProviderConfig {
  provider: MemberProviderType;
  token: string;
  moreEmailsField: 'Secondary Email';
}

export const ORGS_COLLECTION = 'organizations';

export interface OrganizationPartner {
  id: string;
  title: string;
  rosterName?: string;
  canCreateEvents: boolean;
  canCreateMissions: boolean;
}

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
  canCreateEvents: boolean;
  canCreateMissions: boolean;
  supportEmail?: string;
  partners: OrganizationPartner[];
  tags?: {
    groupId: string;
    label: string;
  }[];
}
