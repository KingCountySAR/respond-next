import { Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

import { useMemberContext } from '@respond/hooks/useMemberContext';
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

export function MemberInfo({ name, phone, email }: { name?: boolean; phone?: boolean; email?: boolean }) {
  const member = useMemberContext();
  const [memberInfo, setMemberInfo] = useState<ParticipantInfo | undefined>();

  useEffect(() => {
    if (member) getMemberInfo(member);
  }, [member]);

  const getMemberInfo = async (member: Member) => {
    setMemberInfo(await findMember(member.orgId, member.id));
  };

  return (
    <Stack>
      {name && <Typography>{member.name}</Typography>}
      {phone && memberInfo?.mobilephone && <Typography>{formatPhoneNumber(memberInfo.mobilephone)}</Typography>}
      {email && memberInfo?.email && (
        <Typography>
          <a href={`mailto:${memberInfo.email}`}>{memberInfo.email}</a>
        </Typography>
      )}
    </Stack>
  );
}
