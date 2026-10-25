import { createContext, useContext, type ReactNode } from 'react';
import type {
  ActivitiesResponse,
  ActivityResponse,
  ActivitySummary,
  AdminMemberProvidersResponse,
  AdminSignInProvidersResponse,
  AdminOrganizationsResponse,
  DevSignInRequest,
  GrantResponse,
  TierGrant,
  MemberInfo,
  MemberProviderConfig,
  SignInProviderConfig,
  Organization,
  SavedLocation,
  Session,
  SessionResponse,
  SiteAdminsResponse,
  WeatherReport,
} from '@sync/domain';

/** The HTTP API beside the sync connection. Tests swap it for an in-memory one. */
export interface Api {
  /** Who is signed in on this site; throws when the server can't be reached. */
  session(): Promise<Session | null>;
  /** The development sign-in; throws with the reason it was refused. */
  devSignIn(request: DevSignInRequest): Promise<Session>;
  signOut(): Promise<void>;
  /** Every activity's summary, closed ones long ago included (the live list has open and recent ones). */
  activities(): Promise<ActivitySummary[]>;
  /** An activity as they see it, read once; null when there's no such activity. Throws when the server can't be reached. */
  activity(activityId: string): Promise<ActivityResponse | null>;
  /** Managers of the activity only: a person's grant there, giving it (to someone on its roster), or taking it away. */
  grantOf(activityId: string, personRef: string): Promise<TierGrant | null>;
  grant(activityId: string, personRef: string, tier: 'manage'): Promise<void>;
  revokeGrant(activityId: string, personRef: string): Promise<void>;
  /** Members of a unit matching a name or email; empty when there's no match. */
  searchMembers(unitId: string, query: string): Promise<MemberInfo[]>;
  /** Saved locations by title; all of them for an empty query. */
  searchLocations(query: string): Promise<SavedLocation[]>;
  /** Adds or replaces a saved location. */
  saveLocation(location: SavedLocation): Promise<void>;
  removeLocation(id: string): Promise<void>;
  /** NOAA's current forecast for a point; throws with the reason when there isn't one. */
  weather(lat: number, lon: number): Promise<WeatherReport>;
  admin: AdminApi;
}

/** The organization admin page's calls; each throws with the server's reason. */
export interface AdminApi {
  organizations(): Promise<AdminOrganizationsResponse>;
  saveOrganization(org: Organization): Promise<Organization>;
  removeOrganization(id: string): Promise<void>;
  siteAdmins(): Promise<SiteAdminsResponse>;
  setSiteAdmins(stored: string[]): Promise<SiteAdminsResponse>;
  memberProviders(): Promise<AdminMemberProvidersResponse>;
  saveMemberProvider(provider: MemberProviderConfig): Promise<void>;
  removeMemberProvider(id: string): Promise<void>;
  signInProviders(): Promise<AdminSignInProvidersResponse>;
  saveSignInProvider(provider: SignInProviderConfig): Promise<void>;
  removeSignInProvider(id: string): Promise<void>;
}

async function call<T>(what: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${what}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const grantPath = (activityId: string, personRef: string) => `/api/activities/${encodeURIComponent(activityId)}/grants/${encodeURIComponent(personRef)}`;

export const fetchApi: Api = {
  async session() {
    return (await call<SessionResponse>('session', '/api/auth/session')).session;
  },
  async devSignIn(request) {
    return (await call<{ session: Session }>('sign in', '/api/auth/dev', json('POST', request))).session;
  },
  async signOut() {
    await call('sign out', '/api/auth/logout', { method: 'POST' });
  },
  async activities() {
    return (await call<ActivitiesResponse>('activities', '/api/activities')).data;
  },
  async activity(activityId) {
    const res = await fetch(`/api/activities/${encodeURIComponent(activityId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`activity: HTTP ${res.status}`);
    return (await res.json()) as ActivityResponse;
  },
  async grantOf(activityId, personRef) {
    return (await call<GrantResponse>('grant', grantPath(activityId, personRef))).grant;
  },
  async grant(activityId, personRef, tier) {
    await call('grant', grantPath(activityId, personRef), json('PUT', { tier }));
  },
  async revokeGrant(activityId, personRef) {
    await call('remove grant', grantPath(activityId, personRef), { method: 'DELETE' });
  },
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
  weather(lat, lon) {
    return call<WeatherReport>('weather', `/api/weather?lat=${lat}&lon=${lon}`);
  },
  admin: {
    organizations: () => call<AdminOrganizationsResponse>('organizations', '/api/admin/organizations'),
    async saveOrganization(org) {
      return (await call<{ organization: Organization }>('save organization', `/api/admin/organizations/${encodeURIComponent(org.id)}`, json('PUT', org))).organization;
    },
    async removeOrganization(id) {
      await call('remove organization', `/api/admin/organizations/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    siteAdmins: () => call<SiteAdminsResponse>('site admins', '/api/admin/site-admins'),
    setSiteAdmins: (stored) => call<SiteAdminsResponse>('save site admins', '/api/admin/site-admins', json('PUT', { stored })),
    memberProviders: () => call<AdminMemberProvidersResponse>('member providers', '/api/admin/member-providers'),
    async saveMemberProvider(provider) {
      await call('save member provider', `/api/admin/member-providers/${encodeURIComponent(provider.id)}`, json('PUT', provider));
    },
    async removeMemberProvider(id) {
      await call('remove member provider', `/api/admin/member-providers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    signInProviders: () => call<AdminSignInProvidersResponse>('sign-in providers', '/api/admin/sign-in-providers'),
    async saveSignInProvider(provider) {
      await call('save sign-in provider', `/api/admin/sign-in-providers/${encodeURIComponent(provider.id)}`, json('PUT', provider));
    },
    async removeSignInProvider(id) {
      await call('remove sign-in provider', `/api/admin/sign-in-providers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  },
};

const ApiContext = createContext<Api>(fetchApi);

export function ApiProvider({ api, children }: { api: Api; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export const useApi = (): Api => useContext(ApiContext);
