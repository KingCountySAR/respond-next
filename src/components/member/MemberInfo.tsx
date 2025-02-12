import { Typography, TypographyTypeMap } from '@mui/material';
import { DefaultComponentProps } from '@mui/material/OverridableComponent';
import { DetailedHTMLProps, ImgHTMLAttributes } from 'react';

import { useMemberContext } from '@respond/components/member/MemberProvider';

function Name({ props }: { props?: DefaultComponentProps<TypographyTypeMap<object, 'span'>> }) {
  const member = useMemberContext();
  return <Typography {...props}>{member.name}</Typography>;
}

function Phone({ props }: { props?: DefaultComponentProps<TypographyTypeMap<object, 'span'>> }) {
  const member = useMemberContext();
  return <Typography {...props}>{member.phone}</Typography>;
}

function Email({ props }: { props?: DefaultComponentProps<TypographyTypeMap<object, 'span'>> }) {
  const member = useMemberContext();
  return (
    <Typography {...props}>
      <a href={`mailto:${member.email}`}>{member.email}</a>
    </Typography>
  );
}

function Photo({ props }: { props?: DetailedHTMLProps<ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement> }) {
  const member = useMemberContext();
  return (
    <img //
      src={`/api/v1/organizations/${member.orgId}/members/${member.id}/photo`}
      alt={`Photo of ${member.name}`}
      style={{ width: '8rem', minHeight: '10rem', border: 'solid 1px #777', borderRadius: '4px' }}
      {...props}
    />
  );
}

export const MemberInfo = { Name, Phone, Email, Photo };
