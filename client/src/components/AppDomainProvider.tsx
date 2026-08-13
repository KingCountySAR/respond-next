import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { useStore } from 'react-redux';

import type { AppStore } from '@respond/lib/client/store';
import { OrganizationDomainModel } from '@respond/lib/client/viewmodels/OrganizationDomainModel';
import { UserDomainModel } from '@respond/lib/client/viewmodels/UserDomainModel';

const UserDomainModelContext = createContext<UserDomainModel | null>(null);
const OrganizationDomainModelContext = createContext<OrganizationDomainModel | null>(null);

/**
 * Provides the app-scoped domain models (logged-in user, tenant organization) as
 * session singletons over the Redux store. Mount once, inside the redux <Provider>.
 */
export function AppDomainProvider({ children }: { children: ReactNode }) {
  const store = useStore() as AppStore;
  const user = useMemo(() => new UserDomainModel(store), [store]);
  const organization = useMemo(() => new OrganizationDomainModel(store), [store]);

  useEffect(() => {
    user.connect();
    organization.connect();
    return () => {
      user.dispose();
      organization.dispose();
    };
  }, [user, organization]);

  return (
    <UserDomainModelContext.Provider value={user}>
      <OrganizationDomainModelContext.Provider value={organization}>{children}</OrganizationDomainModelContext.Provider>
    </UserDomainModelContext.Provider>
  );
}

export const useUserDomainModel = () => {
  const model = useContext(UserDomainModelContext);

  if (!model) {
    throw new Error('useUserDomainModel must be used within <AppDomainProvider>');
  }

  return model;
};

export const useOrganizationDomainModel = () => {
  const model = useContext(OrganizationDomainModelContext);

  if (!model) {
    throw new Error('useOrganizationDomainModel must be used within <AppDomainProvider>');
  }

  return model;
};
