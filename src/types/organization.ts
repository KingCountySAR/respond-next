import { MemberProviderType } from './data/MemberProviderType';

export interface Organization {
  id: string;
  title: string;
  rosterName?: string;
}

export interface BaseOrganization extends Organization {
  canCreateMissions: boolean;
  canCreateEvents: boolean;
}

export interface MyOrganization extends BaseOrganization {
  partners: BaseOrganization[];
  memberProvider: MemberProviderType;
  supportEmail?: string;
}
