import { createContext, useContext } from 'react';

import { Member } from '@respond/types/member';

const MemberContext = createContext<Member | null>(null);

export function MemberProvider({ member, children }: { member?: Member; children: React.ReactNode }) {
  return <MemberContext.Provider value={member ?? null}>{children}</MemberContext.Provider>;
}

export const useMemberContext = () => {
  const memberContext = useContext(MemberContext);

  if (!memberContext) {
    throw new Error('useMemberContext has to be used within <MemberProvider>');
  }

  return memberContext;
};
