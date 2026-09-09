import { createContext, ReactNode, useContext, useMemo } from 'react';

import { LocationsStore } from '@/client/models/locationsStore';

const LocationsStoreContext = createContext<LocationsStore | null>(null);

/**
 * Provides a `LocationsStore` singleton to the location forms/manager below
 * it. No Redux involved — locations mutate over REST — so this doesn't need
 * to sit inside the redux <Provider> the way `<AppDomainProvider>` does.
 */
export function LocationsProvider({ children }: { children: ReactNode }) {
  const locationsStore = useMemo(() => new LocationsStore(), []);
  return <LocationsStoreContext.Provider value={locationsStore}>{children}</LocationsStoreContext.Provider>;
}

export const useLocationsStore = () => {
  const store = useContext(LocationsStoreContext);

  if (!store) {
    throw new Error('useLocationsStore must be used within <LocationsProvider>');
  }

  return store;
};
