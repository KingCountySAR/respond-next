import { describe, expect, it } from 'vitest';
import type { AdminMemberProvidersResponse, AdminOrganizationsResponse, MemberProviderView, Organization, SessionResponse, SiteAdminsResponse } from '@sync/domain';
import { OrganizationStore } from '../src/organizations';
import { testApp, testSeed } from './helpers';

const HARPER = 'harper.okonkwo@crt.example.org';
const SITE_ADMIN = 'admin@cvsc.example.org';

async function as(email: string, app = testApp()) {
  const crt = app.client();
  await crt.signIn(email, { name: 'Someone' });
  return crt;
}

const orgOf = (res: { body: AdminOrganizationsResponse }, id: string) => res.body.organizations.find((o) => o.id === id)!;

describe('organization admin', () => {
  it('shows organization admins only theirs, and site admins everything', async () => {
    const harper = await as(HARPER);
    expect((await harper.json<SessionResponse>('/api/auth/session')).body.session?.admin).toBe(true);
    const mine = await harper.json<AdminOrganizationsResponse>('/api/admin/organizations');
    expect(mine.body.organizations.map((o) => o.id)).toEqual(['org-crt']);
    expect(mine.body.siteAdmin).toBe(false);
    expect(mine.body.all.map((o) => o.id).sort()).toEqual(['org-crt', 'org-cvsc', 'org-rmr']);

    const site = await as(SITE_ADMIN);
    const all = await site.json<AdminOrganizationsResponse>('/api/admin/organizations');
    expect(all.body).toMatchObject({ siteAdmin: true, memberProviders: ['kcsara'] });
    expect(all.body.organizations).toHaveLength(3);

    const avery = await as('avery.lindqvist@crt.example.org');
    expect((await avery.json<SessionResponse>('/api/auth/session')).body.session?.admin).toBe(false);
    expect((await avery.request('/api/admin/organizations')).status).toBe(403);
  });

  it("lets an organization's admins change its settings, but not where it sits", async () => {
    const app = testApp();
    const harper = await as(HARPER, app);
    const crt = orgOf(await harper.json<AdminOrganizationsResponse>('/api/admin/organizations'), 'org-crt');
    const edited: Organization = { ...crt, title: 'Cascade Rescue', brand: { primary: '#123' }, hostnames: ['taken.example'], memberProvider: null, parentId: null };
    const saved = await harper.json<{ organization: Organization }>('/api/admin/organizations/org-crt', { method: 'PUT', body: edited });
    expect(saved.status).toBe(200);
    // Hostnames and the parent are the site admins' to change.
    expect(saved.body.organization).toMatchObject({ title: 'Cascade Rescue', brand: { primary: '#123' }, hostnames: ['crt.localhost'], parentId: 'org-cvsc' });
    expect(app.organizations.forHost('crt.localhost')?.title).toBe('Cascade Rescue');

    const rmr = { ...app.organizations.get('org-rmr')!, title: 'Taken over' };
    expect((await harper.request('/api/admin/organizations/org-rmr', { method: 'PUT', body: rmr })).status).toBe(403);
    expect((await harper.request('/api/admin/organizations/org-new', { method: 'PUT', body: { ...rmr, id: 'org-new' } })).status).toBe(403);
    expect((await harper.request('/api/admin/organizations/org-crt', { method: 'DELETE' })).status).toBe(403);
  });

  it('lets site admins add, move and remove organizations, keeping the tree whole', async () => {
    const app = testApp();
    const site = await as(SITE_ADMIN, app);
    const put = (org: Partial<Organization>) => site.json<{ error?: string }>(`/api/admin/organizations/${org.id}`, { method: 'PUT', body: org });
    const k9 = { id: 'org-k9', parentId: 'org-cvsc', title: 'Valley K9', shortTitle: 'K9', hostnames: ['k9.localhost'] };
    expect((await put(k9)).status).toBe(200);
    expect(app.organizations.forHost('k9.localhost')?.title).toBe('Valley K9');
    expect(app.organizations.providerOf('org-k9')).toBe('kcsara');

    expect((await put({ ...k9, hostnames: ['crt.localhost'] })).body.error).toBe('hostname crt.localhost belongs to both org-crt and org-k9');
    expect((await put({ ...k9, parentId: 'org-none' })).body.error).toBe("org-k9's parent org-none doesn't exist");
    expect((await put({ ...app.organizations.get('org-cvsc')!, parentId: 'org-k9' })).body.error).toMatch(/is its own ancestor/);
    expect((await put({ ...k9, memberProvider: 'd4h' })).body.error).toBe("org-k9's member provider d4h doesn't exist");
    expect((await put({ ...k9, title: '' })).body.error).toMatch(/^title: /);
    expect((await site.request('/api/admin/organizations/org-other', { method: 'PUT', body: k9 })).status).toBe(400);

    // Not while others hang off it or partner with it.
    expect((await site.json<{ error: string }>('/api/admin/organizations/org-rmr', { method: 'DELETE' })).body.error).toBe("org-crt's partner org-rmr doesn't exist");
    expect((await site.request('/api/admin/organizations/org-k9', { method: 'DELETE' })).status).toBe(200);
    expect(app.organizations.get('org-k9')).toBeUndefined();
  });

  it("keeps a site admin from removing the site they're on", async () => {
    const app = testApp();
    const site = await as(SITE_ADMIN, app);
    const crt = app.organizations.get('org-crt')!;
    const moved = await site.json<{ error: string }>('/api/admin/organizations/org-crt', { method: 'PUT', body: { ...crt, hostnames: ['crt.example.org'] } });
    expect(moved.body.error).toBe("You're on crt.localhost: keep it, or make the change from another of the organization's sites");
    expect((await site.json<{ error: string }>('/api/admin/organizations/org-crt', { method: 'DELETE' })).body.error).toBe("You can't delete the site you're on");
    expect(app.organizations.forHost('crt.localhost')?.id).toBe('org-crt');
    // Adding one is fine.
    expect((await site.request('/api/admin/organizations/org-crt', { method: 'PUT', body: { ...crt, hostnames: ['CRT.localhost', 'crt.example.org'] } })).status).toBe(200);
  });

  it('keeps site admins from the environment and from the admin page', async () => {
    const app = testApp({ organizations: OrganizationStore.memory(testSeed(), { envAdmins: ['Env.Admin@example.org', ''] }) });
    const env = await as('env.admin@example.org', app);
    expect((await env.json<SiteAdminsResponse>('/api/admin/site-admins')).body).toEqual({ fromEnvironment: ['env.admin@example.org'], stored: [SITE_ADMIN] });
    const set = await env.json<SiteAdminsResponse>('/api/admin/site-admins', { method: 'PUT', body: { stored: ['New.Admin@example.org'] } });
    expect(set.body.stored).toEqual(['new.admin@example.org']);
    expect(app.organizations.isSiteAdmin(SITE_ADMIN)).toBe(false);
    expect((await env.request('/api/admin/site-admins', { method: 'PUT', body: { stored: ['nope'] } })).status).toBe(400);
    expect((await (await as(HARPER, app)).request('/api/admin/site-admins')).status).toBe(403);
  });
});

describe('member provider admin', () => {
  const cedar = { id: 'cedar', kind: 'cedar', url: 'https://cedar.test', tokenUrl: 'https://hydra.test/oauth2/token', clientId: 'sync' };

  it('lets site admins add providers with secrets they can set but never read back', async () => {
    const app = testApp();
    const site = await as(SITE_ADMIN, app);
    const saved = await site.json<{ memberProvider: MemberProviderView }>('/api/admin/member-providers/cedar', { method: 'PUT', body: { ...cedar, clientSecret: 'hunter2' } });
    expect(saved.status).toBe(200);
    expect(saved.body.memberProvider).toEqual({ ...cedar, hasClientSecret: true });
    const list = await site.json<AdminMemberProvidersResponse>('/api/admin/member-providers');
    expect(JSON.stringify(list.body)).not.toContain('hunter2');
    expect(list.body.usedBy).toEqual({ cedar: [], kcsara: ['org-cvsc'] });

    // Saved again without one, the secret stays.
    await site.request('/api/admin/member-providers/cedar', { method: 'PUT', body: { ...cedar, clientId: 'sync2' } });
    expect(app.organizations.memberProvider('cedar')?.config).toMatchObject({ clientId: 'sync2', clientSecret: 'hunter2' });

    expect((await site.json<{ error: string }>('/api/admin/member-providers/cedar', { method: 'PUT', body: { ...cedar, url: 'nope' } })).body.error).toMatch(/^url: /);
    expect((await site.json<{ error: string }>('/api/admin/member-providers/kcsara', { method: 'DELETE' })).body.error).toBe('kcsara is in use by org-cvsc');
    expect((await site.request('/api/admin/member-providers/cedar', { method: 'DELETE' })).status).toBe(200);
  });

  it("keeps them from organization admins", async () => {
    const harper = await as(HARPER);
    expect((await harper.request('/api/admin/member-providers')).status).toBe(403);
    expect((await harper.request('/api/admin/member-providers/cedar', { method: 'PUT', body: cedar })).status).toBe(403);
  });

  it('searches with a changed provider straight away', async () => {
    const app = testApp();
    const site = await as(SITE_ADMIN, app);
    const search = async () => (await site.json<{ data: { name: string }[] }>('/api/v1/organizations/org-crt/members?query=okafor')).body.data.map((m) => m.name);
    expect(await search()).toEqual(['Bo Okafor']);
    const kcsara = app.organizations.memberProviders().find((p) => p.id === 'kcsara')!;
    const units = { CRT: { emailDomain: 'crt.example.org', members: [['Ade', 'Okafor']] } };
    expect((await site.request('/api/admin/member-providers/kcsara', { method: 'PUT', body: { ...kcsara, units } })).status).toBe(200);
    expect(await search()).toEqual(['Ade Okafor']);
  });
});
