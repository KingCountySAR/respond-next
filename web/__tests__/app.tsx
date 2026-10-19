/** The whole web app in jsdom, against the real activity actor over the simulated network. */
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { MemoryPersistence, SyncClient } from '@sync/client';
import { ACTIVITY_LIST_ID, OrganizationSeed, activityProjector, activityRegistry, type ActivityViewer, type BootstrapResponse, type MemberInfo, type Session, type WeatherReport } from '@sync/domain';
import { Hub, MemoryStorage } from '@sync/server';
import { MemoryLocationCatalog } from '../../server/src/locations';
import { FixtureDirectory, fixtureMembers } from '../../server/src/members';
import { MemberProviders } from '../../server/src/memberProviders';
import { OrganizationStore } from '../../server/src/organizations';
import { devSignIn } from '../../server/src/signIn';
import { SummaryWriter } from '../../server/src/summaries';
import type { Api } from '../src/shell/api';
import { App } from '../src/shell/App';
import { viewerOf } from '../src/shell/auth';
import { COMMAND, CRT, RMR, activityArgs } from '../../packages/domain/__tests__/helpers';
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

/** The server's API in memory, for one browser on CRT's site: it keeps one session. */
function apiFor(locations: MemoryLocationCatalog, orgs: OrganizationStore): Api {
  const members = new MemberProviders(orgs, (config) => directories[config.id as keyof typeof directories]);
  let session: Session | null = null;
  const site = () => orgs.get(CRT.id)!;
  const done = <T,>(result: { ok: true; saved: T } | { ok: false; error: string }): T => {
    if (!result.ok) throw new Error(result.error);
    return result.saved;
  };
  return {
    async session() {
      return session && { ...session, admin: orgs.isAdmin(session.email) };
    },
    async devSignIn(request) {
      const result = await devSignIn(members, site(), request);
      if (!result.ok) throw new Error(result.error);
      const { orgId: _, ...data } = result.session;
      session = { ...data, admin: orgs.isAdmin(data.email) };
      return session;
    },
    async signOut() {
      session = null;
    },
    searchMembers: async (unitId, query) => (await members.search(unitId, query)) ?? [],
  searchLocations: (query) => locations.search(query),
  saveLocation: (location) => locations.put(location),
  removeLocation: (id) => locations.remove(id),
    weather: async () => WEATHER,
    admin: {
      organizations: async () => {
        const email = session?.email;
        return { organizations: orgs.editableBy(email), all: orgs.all().map((o) => ({ id: o.id, title: o.title })), memberProviders: orgs.memberProviders().map((p) => p.id), siteAdmin: orgs.isSiteAdmin(email) };
      },
      saveOrganization: async (org) => done(await orgs.save(org, session?.email)),
      removeOrganization: async (id) => void done(await orgs.remove(id, session?.email)),
      siteAdmins: async () => orgs.siteAdmins(),
      setSiteAdmins: async (stored) => (await orgs.setSiteAdmins(stored), orgs.siteAdmins()),
      memberProviders: async () => ({ memberProviders: orgs.memberProviders(), usedBy: orgs.providerUsers() }),
      saveMemberProvider: async (provider) => void done(await orgs.saveProvider(provider, session?.email)),
      removeMemberProvider: async (id) => void done(await orgs.removeProvider(id, session?.email)),
    },
  };
}

export const ACTIVITY = 'a1';
export const TITLE = 'Lost hiker, Mailbox Peak';

/**
 * A server with one activity on it, set up by a command client (`seed`): Dana Field (kcsara:7)
 * staging under CRT. Each app rendered connects as its own client.
 */
export async function serverWithActivity(options: { siteAdmins?: string[] } = {}) {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  // The real server setup, with summaries written quickly so lists update within a test.
  const summaries = new SummaryWriter(() => hub, { debounceMs: 20, maxWaitMs: 100 });
  const hub: Hub = new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: Date.now, onCommit: summaries.onCommit, readOnly: (id) => id === ACTIVITY_LIST_ID });
  const net = new SimNetwork(hub, mulberry32(1));
  net.latencyMs = 10;
  const seed = new SyncClient({ registry: activityRegistry, viewer: COMMAND, transport: net.transportFor(0, COMMAND) });
  await seed.start();
  await seed.open(ACTIVITY);
  seed.mutate(ACTIVITY, 'createActivity', activityArgs({ startTime: Date.now() - 60 * 60 * 1000, description: 'Hiker overdue since 1800.', mapId: 'ABC12' }));
  seed.mutate(ACTIVITY, 'addParticipant', { personRef: 'kcsara:7', firstname: 'Dana', lastname: 'Field', unit: CRT, status: 'staging' });

  const locations = new MemoryLocationCatalog([SAVED_TRAILHEAD]);
  const organizations = OrganizationStore.memory(organizationSeed(), { envAdmins: options.siteAdmins });
  const api = apiFor(locations, organizations);
  // People signing in on CRT's site respond under CRT.
  const site = (): BootstrapResponse => ({ config: organizations.siteConfig(organizations.get(CRT.id)!, { devSignIn: true, buildId: 'test' }) });
  let nextClient = 1;
  const renderApp = (path = '/') => {
    window.history.replaceState(null, '', path);
    const index = nextClient++;
    return render(<App bootstrap={async () => site()} api={api} sync={{ transport: (s: Session) => net.transportFor(index, viewerOf(s) as ActivityViewer)(), persistence: () => new MemoryPersistence() }} />);
  };
  return { net, seed, locations, organizations, renderApp, stop: () => seed.stop() };
}

/** Signs in by email (`given.family@crt.example.org`); everyone named here is in CRT's directory. */
export async function signIn(name: string, personRef: string, tier: 'field' | 'command' = 'field') {
  await screen.findByText('dev sign in');
  const email = `${name.toLowerCase().split(' ').join('.')}@crt.example.org`;
  const known = await directories.kcsara.byEmail(email);
  if (known?.member.personRef !== personRef) throw new Error(`${name} is not ${personRef} in the test directory`);
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: email } });
  if (tier !== 'field') {
    fireEvent.mouseDown(screen.getByLabelText('Tier'));
    fireEvent.click(await screen.findByRole('option', { name: tier === 'command' ? 'Command' : 'Support' }));
  }
  fireEvent.click(screen.getByText('dev sign in'));
  await waitFor(() => expect(screen.queryByText('dev sign in')).toBeNull());
}
