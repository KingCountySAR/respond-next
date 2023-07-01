import { MemberProviderType } from './MemberProviderType'

export interface MemberProviderConfig {
  provider: MemberProviderType,
  token: string,
  moreEmailsField: 'Secondary Email',
}

export const ORGANIZATION_COLLECTION = 'organizations';

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
  };
  memberProvider: MemberProviderConfig;
  canCreateEvents: boolean;
  canCreateMissions: boolean;
  supportEmail?: string;
  partners: OrganizationPartner[];
  tags?: {
    groupId: string;
    label: string;
  }[];
}