import { createContext, useContext, useEffect, useState } from 'react';

import { apiFetch } from '@respond/lib/api';
import { Member } from '@respond/types/member';
import { ParticipantInfo } from '@respond/types/participant';

const findMember = async (orgId: string, memberId: string) => {
  return (await apiFetch<{ data: ParticipantInfo }>(`/api/v1/organizations/${orgId}/members/${memberId}`)).data;
};

const formatPhoneNumber = (phoneNumberString: string, includeIntlCode: boolean = false) => {
  const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    const intlCode = match[1] ? '+1 ' : '';
    return [includeIntlCode ? intlCode : '', '(', match[2], ') ', match[3], '-', match[4]].join('');
  }
  return null;
};

const MemberContext = createContext<Member | null>(null);

export function MemberProvider({ member, children }: { member: Member; children: React.ReactNode }) {
  const [enrichedMember, setEnrichedMember] = useState<Member>(member);

  useEffect(() => {
    if (member) getMemberInfo(member);
  }, [member]);

  const getMemberInfo = async (member: Member) => {
    const memberInfo = await findMember(member.orgId, member.id);
    setEnrichedMember({ ...member, email: memberInfo.email, phone: formatPhoneNumber(memberInfo.mobilephone ?? '') ?? undefined });
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
