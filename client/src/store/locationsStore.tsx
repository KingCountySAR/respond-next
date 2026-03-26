import { Location, LocationsResult } from '@app/shared/api';
import { action, makeObservable, observable, runInAction } from 'mobx';
import { createContext, useContext } from 'react';

export class LocationsStore {
  @observable accessor locations: Location[] = [];
  @observable accessor loaded: boolean = false;
  @observable accessor loading: boolean = false;

  constructor() {
    makeObservable(this);
  }

  @action.bound
  async load(force?: boolean) {
    if (this.loaded && !force) {
      return;
    }

    this.loading = true;
    try {
      const response = await fetch('/api/locations');
      const json = await response.json() as LocationsResult;
      runInAction(() => {
        this.locations = json.result;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
        this.loaded = true;
      });
    }
  }

  @action.bound
  async save(location: Location) {
    await fetch(`/api/locations/${location.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(location),
    });
    runInAction(() => {
      this.locations = [ location, ...this.locations.filter(f => f.id !== location.id) ];
    });
  }

  @action.bound
  async remove(location: Location) {
    if (location.id) {
      await fetch(`/api/locations/${location.id}`, { method: 'DELETE' });
    }
    runInAction(() => {
      this.locations = this.locations.filter(f => f.id !== location.id);
    });
  }
}

const LocationsContextInstance = createContext<LocationsStore | null>(null);

export const LocationsProvider = ({ store, children }: { store: LocationsStore; children: React.ReactNode }) => (
  <LocationsContextInstance.Provider value={store}>{children}</LocationsContextInstance.Provider>
);

export const useLocationsContext = () => {
  const LocationsContext = useContext(LocationsContextInstance);

  if (!LocationsContext) {
    throw new Error('useLocationsContext must be used within <LocationsProvider>');
  }

  return LocationsContext;
};
