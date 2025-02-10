import { useMemberContext } from '@respond/hooks/useMemberContext';

export function MemberPhoto() {
  const member = useMemberContext();
  return (
    <img //
      src={`/api/v1/organizations/${member.orgId}/members/${member.id}/photo`}
      alt={`Photo of ${member.name}`}
      style={{ width: '8rem', minHeight: '10rem', border: 'solid 1px #777', borderRadius: '4px' }}
    />
  );
}
