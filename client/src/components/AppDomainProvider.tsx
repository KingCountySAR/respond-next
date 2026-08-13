import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { useStore } from 'react-redux';

import type { AppStore } from '@respond/lib/client/store';

import { ObservableClock } from 'src/models/observableClock';
import { OrganizationDomainModel } from 'src/models/organizationDomainModel';
import { UserDomainModel } from 'src/models/userDomainModel';

const UserDomainModelContext = createContext<UserDomainModel | null>(null);
const OrganizationDomainModelContext = createContext<OrganizationDomainModel | null>(null);
const ClockContext = createContext<ObservableClock | null>(null);

/**
 * Provides the app-scoped domain models (logged-in user, tenant organization) as
 * session singletons over the Redux store. Mount once, inside the redux <Provider>.
 */
export function AppDomainProvider({ children }: { children: ReactNode }) {
  const clock = useMemo(() => new ObservableClock(), []);
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
    <ClockContext.Provider value={clock}>
      <UserDomainModelContext.Provider value={user}>
        <OrganizationDomainModelContext.Provider value={organization}>{children}</OrganizationDomainModelContext.Provider>
      </UserDomainModelContext.Provider>
    </ClockContext.Provider>
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

export const useClock = () => {
  const model = useContext(ClockContext);

  if (!model) {
    throw new Error('useClock must be used within <AppDomainProvider>');
  }

  return model;
};
