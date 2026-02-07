import { MemberProviderType } from '@respond/types/data/MemberProviderType';

export interface MemberInfo {
  id: string;
  label?: string;
  name: string;
  given_name: string;
  family_name: string;
  groups: string[];
  email?: string;
  mobilephone?: string;
}

export interface MemberAuthInfo {
  provider: string;
  email: string;
}

export interface MemberProvider {
  getMemberInfo<TOptions = undefined>(organizationId: string, authPayload: MemberAuthInfo, providerOptions: TOptions): Promise<MemberInfo | undefined>;
  getMemberInfoById(memberId: string): Promise<MemberInfo | undefined>;
  getMemberPhoto(memberId: string): Promise<ArrayBuffer | undefined>;
  getParticipantInfo(query: string): Promise<MemberInfo | undefined>;
  searchMembers(organizationId: string, query: string): Promise<Array<MemberInfo>>;
  refresh(force?: boolean): Promise<{ ok: boolean; runtime: number; cached?: boolean }>;
}

export class MemberProviderRegistry {
  private lookup: { [key: string]: MemberProvider } = {};

  register(key: MemberProviderType, provider: MemberProvider) {
    this.lookup[key] = provider;
  }

  get(key: string) {
    return this.lookup[key];
  }
}

export const defaultMembersRepositoryRegistry = new MemberProviderRegistry();
