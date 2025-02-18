import { createContext, useContext, useEffect, useState } from 'react';

import { apiFetch } from '@respond/lib/api';
import { Member, MemberIdType } from '@respond/types/member';

const findMember = async (orgId: string, memberId: MemberIdType) => {
  return (await apiFetch<{ data: Member }>(`/api/v1/organizations/${orgId}/members/${memberId}`)).data;
};

const formatPhoneNumber = (phoneNumberString: string, includeIntlCode: boolean = false) => {
  const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    const intlCode = match[1] ? '+1 ' : '';
    return [includeIntlCode ? intlCode : '', '(', match[2], ') ', match[3], '-', match[4]].join('');
  }
  return undefined;
};

const MemberContext = createContext<Member | null>(null);

export function MemberProvider({ member, children }: { member: Member; children: React.ReactNode }) {
  const [enrichedMember, setEnrichedMember] = useState<Member>(member);

  useEffect(() => {
    if (member) getMemberInfo(member);
  }, [member]);

  const getMemberInfo = async (member: Member) => {
    const memberInfo = await findMember(member.orgId, member.id);
    setEnrichedMember({ ...member, email: memberInfo.email, phone: formatPhoneNumber(memberInfo.phone ?? '') });
  };

  return <MemberContext.Provider value={enrichedMember}>{children}</MemberContext.Provider>;
}

export const useMemberContext = () => {
  const memberContext = useContext(MemberContext);

  if (!memberContext) {
    throw new Error('useMemberContext has to be used within <MemberProvider>');
  }

  return memberContext;
};
