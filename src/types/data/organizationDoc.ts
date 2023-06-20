export interface D4HConfig {
  provider: 'd4hMembers',
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
  memberProvider: D4HConfig;
  canCreateEvents: boolean;
  canCreateMissions: boolean;
  partners: OrganizationPartner[];
  tags?: {
    groupId: string;
    label: string;
  }[];
}