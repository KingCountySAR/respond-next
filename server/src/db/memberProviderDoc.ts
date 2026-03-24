export enum MemberProviderType {
  D4H = 'D4HMembers',
}

export const MemberProviderName: Record<MemberProviderType, string> = {
  [MemberProviderType.D4H]: 'D4H',
};

export interface MemberProviderDoc {
  name: string;
  provider: string;
}

export interface D4HMemberProviderDoc extends MemberProviderDoc {
  name: MemberProviderType.D4H,
  teamId: string;
  token: string;
  moreEmailsField?: string;
}

export const MEMBER_PROVIDER_COLLECTION = 'member-providers';

export function isD4HProviderDoc(doc: MemberProviderDoc): doc is D4HMemberProviderDoc {
  return doc.provider === MemberProviderType.D4H;
}
