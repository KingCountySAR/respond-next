/** The whole web app in jsdom, against the real activity actor over the simulated network. */
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { MemoryPersistence, SyncClient } from '@sync/client';
import { ACTIVITY_ARCHIVE_ID, ACTIVITY_LIST_ID, OrganizationSeed, activityOfScope, activityProjector, activityRegistry, viewerOfSession, type ActivitySummary, type ActivityViewer, type BootstrapResponse, type MemberInfo, type Session, type WeatherReport } from '@sync/domain';
import { Hub, MemoryStorage, type HubDeps } from '@sync/server';
import { MemoryLocationCatalog } from '../../server/src/locations';
import { FixtureDirectory, fixtureMembers } from '../../server/src/members';
import { MemberProviders } from '../../server/src/memberProviders';
import { OrganizationStore } from '../../server/src/organizations';
import { devSignIn, refreshSession, tierOn } from '../../server/src/signIn';
import type { SessionData } from '../../server/src/sessions';
import { MemoryGrantStore } from '../../server/src/grants';
import { SummaryWriter } from '../../server/src/summaries';
import { ActivityLogWriter } from '../../server/src/activityLog';
import type { Api } from '../src/shell/api';
import { App } from '../src/shell/App';
import { MANAGER, CRT, RMR, activityArgs } from '../../packages/domain/__tests__/helpers';
import { SimNetwork, mulberry32 } from '../../test/integration/sim';

export { CRT, RMR };

// The whole app renders over a network with latency while other test files share the CPU: the
// default 1 s wait for findBy* is too tight.
configure({ asyncUtilTimeout: 5000 });

/** A member with a given id, at CRT's email domain. */
const member = (source: string, id: number, given: string, family: string): MemberInfo => fixtureMembers(source, [[given, family]], 'crt.example.org', id)[0]!;

/**
 * The member directories. CRT's (provider `kcsara`): Avery and Kai Lindqvist (kcsara:1, kcsara:2),
 * Dana Field (kcsara:7, on the activity already), Eli Ng (kcsara:9) and Alice Adams (kcsara:101, who
 * runs things). RMR's (provider `rmr`): Rowan Pike (rmr:1).
 */
const directories = {
  kcsara: new FixtureDirectory({ CRT: [member('kcsara', 1, 'Avery', 'Lindqvist'), member('kcsara', 2, 'Kai', 'Lindqvist'), member('kcsara', 7, 'Dana', 'Field'), member('kcsara', 9, 'Eli', 'Ng'), member('kcsara', 101, 'Alice', 'Adams')] }),
  rmr: new FixtureDirectory({ RMR: fixtureMembers('rmr', [['Rowan', 'Pike']], 'rmr.example.org') }),
};

/** The site is CRT (Alice is its admin), with RMR as a partner; each has its own member provider. */
const organizationSeed = (): OrganizationSeed =>
  OrganizationSeed.parse({
    memberProviders: [
      { id: 'kcsara', kind: 'fixture' },
      { id: 'rmr', kind: 'fixture' },
    ],
    organizations: [
      {
        id: CRT.id,
        title: CRT.title,
        shortTitle: 'CRT',
        hostnames: ['crt.localhost'],
        emailDomains: ['crt.example.org'],
        brand: { primary: '#336' },
        memberProvider: 'kcsara',
        providerUnit: 'CRT',
        canCreateMissions: true,
        canCreateEvents: true,
        partners: [{ id: RMR.id, canCreateMissions: true, canCreateEvents: false }],
        admins: ['alice.adams@crt.example.org'],
      },
      { id: RMR.id, title: RMR.title, shortTitle: 'RMR', hostnames: ['rmr.localhost'], emailDomains: ['rmr.example.org'], memberProvider: 'rmr', providerUnit: 'RMR', canCreateMissions: true },
    ],
  });

/** The saved-location catalog, fresh for each server: one saved location to start. */
export const SAVED_TRAILHEAD = { id: 'loc-1', title: 'Mailbox Peak Trailhead', lat: 47.4672, lon: -121.6754, address: 'SE Middle Fork Rd', description: 'Upper lot fills by 8am.' };
/** Every point's forecast. */
export const WEATHER: WeatherReport = {
  forecastUrl: 'https://forecast.weather.gov/MapClick.php?lat=47.4672&lon=-121.6754',
  period: { name: 'This Afternoon', temperature: 41, temperatureUnit: 'F', humidity: 88, windSpeed: '5 mph', shortForecast: 'Light Rain', icon: null },
};

/** The server's API in memory, for one browser on CRT's site: it keeps one session (`current`). */
function apiFor(locations: MemoryLocationCatalog, orgs: OrganizationStore, hub: Hub, grants: MemoryGrantStore): { api: Api; current: () => SessionData | null; changed: (personRef: string) => Promise<void> } {
  const members = new MemberProviders(orgs, (config) => directories[config.id as keyof typeof directories]);
  const people = { members, grants };
  let data: SessionData | null = null;
  const toSession = ({ orgId: _, grants: _grants, ...rest }: SessionData): Session => ({ ...rest, admin: orgs.isAdmin(rest.email) });
  const managing = (activityId: string) => {
    if (!data || tierOn(data, activityId) !== 'manage') throw new Error('Only a manager of this activity can grant tiers');
  };
  // As the server: their session brought up to date, and their connections closed.
  const changed = async (personRef: string) => {
    if (data?.personRef === personRef) data = await refreshSession(people, data);
    hub.disconnectWhere((viewer) => viewer.userId === personRef);
  };
  const site = () => orgs.get(CRT.id)!;
  const done = <T,>(result: { ok: true; saved: T } | { ok: false; error: string }): T => {
    if (!result.ok) throw new Error(result.error);
    return result.saved;
  };
  const api: Api = {
    async session() {
      return data && toSession(data);
    },
    async devSignIn(request) {
      const result = await devSignIn(people, site(), request);
      if (!result.ok) throw new Error(result.error);
      data = result.session;
      return toSession(data);
    },
    async signOut() {
      data = null;
    },
    // As the server's routes: the archive, and one activity as they see it there.
    async activities() {
      const { records } = await hub.read(ACTIVITY_ARCHIVE_ID, viewerOfSession(data!));
      return records.filter((r) => r.type === 'activitySummary').map(({ version: _, ...summary }) => summary as unknown as ActivitySummary);
    },
    async activity(activityId) {
      const viewer = viewerOfSession(data!);
      const read = await hub.read(activityId, { ...viewer, tier: tierOn(data!, activityId) });
      return read.version ? { activityId, ...read } : null;
    },
    async grantOf(activityId, personRef) {
      managing(activityId);
      return (await grants.get(personRef, activityId)) ?? null;
    },
    async grant(activityId, personRef, tier) {
      managing(activityId);
      const roster = (await hub.actor(activityId)).projectedRecords('manage');
      if (!roster.some((r) => r.type === 'participant' && (r as { personRef?: string }).personRef === personRef)) throw new Error(`${personRef} isn't on that activity's roster`);
      await grants.set(personRef, activityId, { tier, grantedBy: data!.email, grantedAt: Date.now() });
      await changed(personRef);
    },
    async revokeGrant(activityId, personRef) {
      managing(activityId);
      await grants.remove(personRef, activityId);
      await changed(personRef);
    },
    searchMembers: async (unitId, query) => (await members.search(unitId, query)) ?? [],
  searchLocations: (query) => locations.search(query),
  saveLocation: (location) => locations.put(location),
  removeLocation: (id) => locations.remove(id),
    weather: async () => WEATHER,
    admin: {
      organizations: async () => {
        const email = data?.email;
        return { organizations: orgs.editableBy(email), all: orgs.all().map((o) => ({ id: o.id, title: o.title })), memberProviders: orgs.memberProviders().map((p) => p.id), signInProviders: orgs.signInProviders().map((p) => p.id), siteAdmin: orgs.isSiteAdmin(email) };
      },
      saveOrganization: async (org) => done(await orgs.save(org, data?.email)),
      removeOrganization: async (id) => void done(await orgs.remove(id, data?.email)),
      siteAdmins: async () => orgs.siteAdmins(),
      setSiteAdmins: async (stored) => (await orgs.setSiteAdmins(stored), orgs.siteAdmins()),
      memberProviders: async () => ({ memberProviders: orgs.memberProviders(), usedBy: orgs.providerUsers() }),
      saveMemberProvider: async (provider) => void done(await orgs.saveProvider(provider, data?.email)),
      removeMemberProvider: async (id) => void done(await orgs.removeProvider(id, data?.email)),
      signInProviders: async () => ({ signInProviders: orgs.signInProviders(), usedBy: orgs.signInProviderUsers() }),
      saveSignInProvider: async (provider) => void done(await orgs.saveSignInProvider(provider, data?.email)),
      removeSignInProvider: async (id) => void done(await orgs.removeSignInProvider(id, data?.email)),
    },
  };
  return { api, current: () => data, changed };
}

export const ACTIVITY = 'a1';
export const TITLE = 'Lost hiker, Mailbox Peak';

/**
 * A server with one activity on it, set up by a manager client (`seed`): Dana Field (kcsara:7)
 * staging under CRT. Each app rendered connects as its own client.
 */
export async function serverWithActivity(options: { siteAdmins?: string[]; devSignIn?: boolean; googleSignIn?: boolean } = {}) {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  // The real server setup, with summaries written quickly so lists update within a test.
  const summaries = new SummaryWriter(() => hub, { debounceMs: 20, maxWaitMs: 100 });
  const activityLog = new ActivityLogWriter(() => hub);
  const onCommit: HubDeps['onCommit'] = (id, view, changes) => {
    summaries.onCommit(id, view);
    activityLog.onCommit(id, view, changes);
  };
  const hub: Hub = new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: Date.now, onCommit, readOnly: (id) => id === ACTIVITY_LIST_ID || id === ACTIVITY_ARCHIVE_ID });
  const net = new SimNetwork(hub, mulberry32(1));
  net.latencyMs = 10;
  const seed = new SyncClient({ registry: activityRegistry, viewer: MANAGER, transport: net.transportFor(0, MANAGER) });
  await seed.start();
  await seed.open(ACTIVITY);
  seed.mutate(ACTIVITY, 'createActivity', activityArgs({ startTime: Date.now() - 60 * 60 * 1000, description: 'Hiker overdue since 1800.', mapId: 'ABC12' }));
  seed.mutate(ACTIVITY, 'addParticipant', { personRef: 'kcsara:7', firstname: 'Dana', lastname: 'Field', unit: CRT, status: 'staging' });

  const locations = new MemoryLocationCatalog([SAVED_TRAILHEAD]);
  const organizations = OrganizationStore.memory(organizationSeed(), { envAdmins: options.siteAdmins });
  const grants = new MemoryGrantStore();
  const { api, current, changed } = apiFor(locations, organizations, hub, grants);
  /** A manager gives this person manage access on an activity, as through the API. */
  const grantManage = async (personRef: string, activityId = ACTIVITY) => {
    await grants.set(personRef, activityId, { tier: 'manage', grantedBy: 'alice.adams@crt.example.org', grantedAt: Date.now() });
    await changed(personRef);
  };
  // Each connection is the session as it is when it opens, as the server's WebSocket upgrade.
  const transport = (index: number) => () => {
    const session = current()!;
    const viewer = viewerOfSession(session);
    const tier = (id: string) => tierOn(session, activityOfScope(id));
    return net.transportFor(index, viewer, (id) => (tier(id) === viewer.tier ? undefined : { ...viewer, tier: tier(id) }))();
  };
  // People signing in on CRT's site respond under CRT.
  const site = (): BootstrapResponse => ({ config: organizations.siteConfig(organizations.get(CRT.id)!, { devSignIn: options.devSignIn ?? true, googleSignIn: options.googleSignIn, buildId: 'test' }) });
  let nextClient = 1;
  const renderApp = (path = '/') => {
    window.history.replaceState(null, '', path);
    const index = nextClient++;
    return render(<App bootstrap={async () => site()} api={api} sync={{ transport: transport(index), persistence: () => new MemoryPersistence() }} />);
  };
  return { net, seed, locations, organizations, grants, grantManage, renderApp, stop: () => seed.stop() };
}

/** Signs in by email (`given.family@crt.example.org`); everyone named here is in CRT's directory. */
export async function signIn(name: string, personRef: string, tier: 'respond' | 'manage' = 'respond') {
  fireEvent.click(await screen.findByText('Dev sign-in'));
  const email = `${name.toLowerCase().split(' ').join('.')}@crt.example.org`;
  const known = await directories.kcsara.byEmail(email);
  if (known?.member.personRef !== personRef) throw new Error(`${name} is not ${personRef} in the test directory`);
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: email } });
  if (tier !== 'respond') {
    fireEvent.mouseDown(screen.getByLabelText('Tier'));
    fireEvent.click(await screen.findByRole('option', { name: 'Manage' }));
  }
  fireEvent.click(screen.getByText('dev sign in'));
  await waitFor(() => expect(screen.queryByText('dev sign in')).toBeNull());
}
