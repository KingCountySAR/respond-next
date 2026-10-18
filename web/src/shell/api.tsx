import { createContext, useContext, type ReactNode } from 'react';
import type { MemberInfo } from '@sync/domain';

/** The HTTP API beside the sync connection. Tests swap it for an in-memory one. */
export interface Api {
  /** Members of a unit matching a name or email; empty when there's no match. */
  searchMembers(unitId: string, query: string): Promise<MemberInfo[]>;
}

export const fetchApi: Api = {
  async searchMembers(unitId, query) {
    const res = await fetch(`/api/v1/organizations/${encodeURIComponent(unitId)}/members?query=${encodeURIComponent(query)}`);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`member search: HTTP ${res.status}`);
    return ((await res.json()) as { data: MemberInfo[] }).data;
  },
};

const ApiContext = createContext<Api>(fetchApi);

export function ApiProvider({ api, children }: { api: Api; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export const useApi = (): Api => useContext(ApiContext);
