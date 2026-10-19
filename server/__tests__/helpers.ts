/** A test server with fictional organizations, and clients that sign in on one of its sites. */
import { activityProjector, activityRegistry, OrganizationSeed } from '@sync/domain';
import { Hub, MemoryStorage } from '@sync/server';
import { createSyncApp, type SyncAppOptions } from '../src/app';
import { MemberProviders } from '../src/memberProviders';
import { OrganizationStore } from '../src/organizations';
import { MemorySessionStore } from '../src/sessions';

/**
 * An umbrella (Cascade Valley SAR Council, `localhost`) over CRT (`crt.localhost`) and RMR
 * (`rmr.localhost`), whose members come from the umbrella's fixture provider `kcsara`. CRT tags
 * its Medical group MED. Harper is CRT's admin; admin@cvsc.example.org is a site admin.
 */
export const testSeed = (): OrganizationSeed =>
  OrganizationSeed.parse({
    memberProviders: [
      {
        id: 'kcsara',
        kind: 'fixture',
        units: {
          CRT: { emailDomain: 'crt.example.org', members: [['Avery', 'Lindqvist', 'Field'], ['Kai', 'Lindqvist'], ['Bo', 'Okafor', 'Medical'], ['Harper', 'Okonkwo']] },
          RMR: { emailDomain: 'rmr.example.org', members: [['Rowan', 'Pike']] },
        },
      },
    ],
    organizations: [
      { id: 'org-cvsc', title: 'Cascade Valley SAR Council', shortTitle: 'CVSC', hostnames: ['localhost'], emailDomains: ['cvsc.example.org'], brand: { primary: '#933' }, memberProvider: 'kcsara' },
      {
        id: 'org-crt',
        parentId: 'org-cvsc',
        title: 'Cascade Rescue Team',
        shortTitle: 'CRT',
        hostnames: ['crt.localhost'],
        emailDomains: ['crt.example.org'],
        brand: { primary: '#336', icon: `data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}` },
        providerUnit: 'CRT',
        memberTags: { Medical: 'MED' },
        canCreateMissions: true,
        canCreateEvents: true,
        partners: [{ id: 'org-rmr', canCreateMissions: true }],
        admins: ['harper.okonkwo@crt.example.org'],
      },
      { id: 'org-rmr', parentId: 'org-cvsc', title: 'Ridgeline Mountain Rescue', shortTitle: 'RMR', hostnames: ['rmr.localhost'], emailDomains: ['rmr.example.org'], providerUnit: 'RMR', canCreateMissions: true },
    ],
    siteAdmins: ['admin@cvsc.example.org'],
  });

export const CRT_HOST = 'crt.localhost';

export function testApp(options: Partial<SyncAppOptions> = {}) {
  const organizations = options.organizations ?? OrganizationStore.memory(testSeed());
  const sessions = new MemorySessionStore();
  const members = new MemberProviders(organizations);
  const hub = new Hub({ storage: new MemoryStorage(), registry: activityRegistry, projector: activityProjector, now: Date.now });
  const { app } = createSyncApp(hub, { organizations, sessions, members, devSignIn: true, ...options });

  /** Requests on one site (by hostname), keeping the session cookie once signed in. */
  const client = (host = CRT_HOST) => {
    let cookie: string | undefined;
    // `host` sends this client's cookie to another site.
    const request = (path: string, init: { method?: string; body?: unknown; host?: string } = {}) =>
      app.request(path, {
        method: init.method ?? 'GET',
        headers: { host: init.host ?? host, ...(cookie && { cookie }), ...(init.body !== undefined && { 'content-type': 'application/json' }) },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    return {
      request,
      async json<T>(path: string, init?: { method?: string; body?: unknown; host?: string }): Promise<{ status: number; body: T }> {
        const res = await request(path, init);
        return { status: res.status, body: (await res.json()) as T };
      },
      async signIn(email: string, more: { name?: string; personRef?: string; tier?: string; class?: string } = {}) {
        const res = await request('/api/auth/dev', { method: 'POST', body: { email, tier: 'field', class: 'member', ...more } });
        const set = res.headers.get('set-cookie');
        if (set) cookie = set.split(';')[0];
        return res;
      },
    };
  };
  return { app, organizations, sessions, client };
}
