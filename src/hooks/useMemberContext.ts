import { createContext, useContext } from 'react';

import { Member } from '@respond/types/member';

export const MemberContext = createContext<Member | null>(null);

export const useMemberContext = () => {
  const memberContext = useContext(MemberContext);

  if (!memberContext) {
    throw new Error('useMemberContext has to be used within <MemberContext.Provider>');
  }

  return memberContext;
};
