import { ParticipantInfo } from '@app/shared/api';

import { MemberProviderType } from '@server/db/memberProviderDoc.js';

export interface MemberInfo {
  id: string;
  groups: string[];
  email?: string;
  mobilephone?: string;
}

export interface MemberAuthInfo {
  provider: string;
  email: string;
}

export interface MemberProvider {
  getMemberInfoByEmail(email: string): Promise<MemberInfo | undefined>;
  getMemberInfoById(memberId: string): Promise<MemberInfo | undefined>;
  getMemberPhoto(memberId: string): Promise<ArrayBuffer | undefined>;
  getParticipantInfo(query: string): Promise<ParticipantInfo | undefined>;
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
