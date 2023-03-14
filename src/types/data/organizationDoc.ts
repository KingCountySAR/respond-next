export interface D4HConfig {
  provider: 'd4hMembers',
  token: string,
  moreEmailsField: 'Secondary Email',
}

export const ORGANIZATION_COLLECTION = 'organizations';

export interface OrganizationDoc {
  id: string;
  domain: string;
  title: string;
  rosterName?: string;
  mouName?: string;
  brand: {
    primary: string;
  };
  memberProvider: D4HConfig;
}