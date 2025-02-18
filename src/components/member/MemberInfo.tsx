import { Typography } from '@mui/material';

import { useMemberContext } from '@respond/components/member/MemberProvider';

function Name() {
  const member = useMemberContext();
  return <Typography>{member.name}</Typography>;
}

function Phone() {
  const member = useMemberContext();
  return <Typography>{member.phone}</Typography>;
}

function Email() {
  const member = useMemberContext();
  return (
    <Typography>
      <a href={`mailto:${member.email}`}>{member.email}</a>
    </Typography>
  );
}

function Photo() {
  const member = useMemberContext();
  return (
    <img //
      src={`/api/v1/organizations/${member.orgId}/members/${member.id}/photo`}
      alt={`Photo of ${member.name}`}
      style={{ width: '8rem', minHeight: '10rem', border: 'solid 1px #777', borderRadius: '4px' }}
    />
  );
}

export const MemberInfo = { Name, Phone, Email, Photo };
