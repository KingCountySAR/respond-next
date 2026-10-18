import { createContext, useContext, type ReactNode } from 'react';
import type { MemberInfo, SavedLocation } from '@sync/domain';

/** The HTTP API beside the sync connection. Tests swap it for an in-memory one. */
export interface Api {
  /** Members of a unit matching a name or email; empty when there's no match. */
  searchMembers(unitId: string, query: string): Promise<MemberInfo[]>;
  /** Saved locations by title; all of them for an empty query. */
  searchLocations(query: string): Promise<SavedLocation[]>;
  /** Adds or replaces a saved location. */
  saveLocation(location: SavedLocation): Promise<void>;
  removeLocation(id: string): Promise<void>;
}

async function call<T>(what: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${what}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const fetchApi: Api = {
  async searchMembers(unitId, query) {
    const res = await fetch(`/api/v1/organizations/${encodeURIComponent(unitId)}/members?query=${encodeURIComponent(query)}`);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`member search: HTTP ${res.status}`);
    return ((await res.json()) as { data: MemberInfo[] }).data;
  },
  async searchLocations(query) {
    return (await call<{ data: SavedLocation[] }>('location search', `/api/v1/locations?query=${encodeURIComponent(query)}`)).data;
  },
  async saveLocation(location) {
    await call('save location', '/api/v1/locations', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(location) });
  },
  async removeLocation(id) {
    await call('remove location', `/api/v1/locations/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

const ApiContext = createContext<Api>(fetchApi);

export function ApiProvider({ api, children }: { api: Api; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export const useApi = (): Api => useContext(ApiContext);
