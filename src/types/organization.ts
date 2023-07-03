import { MemberProviderType } from './data/MemberProviderType'

export interface BaseOrganization {
  id: string;
  title: string;
  rosterName?: string;
  canCreateMissions: boolean;
  canCreateEvents: boolean;
}

export interface MyOrganization extends BaseOrganization {
  partners: BaseOrganization[];
  memberProvider: MemberProviderType;
  supportEmail?: string;
}