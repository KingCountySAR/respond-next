import { describe, expect, it } from 'vitest';
import type { BootstrapResponse, SessionResponse } from '@sync/domain';
import { OrganizationStore } from '../src/organizations';
import { testApp, testSeed } from './helpers';

describe('sites', () => {
  it("serve each hostname's organization, brand and partners", async () => {
    const { client } = testApp();
    const crt = await client('crt.localhost:4000').json<BootstrapResponse>('/api/bootstrap');
    expect(crt.body.config.organization).toMatchObject({ id: 'org-crt', shortTitle: 'CRT', partners: [{ id: 'org-rmr', shortTitle: 'RMR', canCreateMissions: true, canCreateEvents: false }] });
    expect(crt.body.config.theme.primary).toBe('#336');
    expect(crt.body.config.devSignIn).toBe(true);
    // RMR has no brand of its own: it takes the umbrella's.
    expect((await client('RMR.localhost').json<BootstrapResponse>('/api/bootstrap')).body.config.theme.primary).toBe('#933');
    const unknown = await client('elsewhere.example').json<{ error: string }>('/api/bootstrap');
    expect(unknown).toEqual({ status: 404, body: { error: 'No site is set up for elsewhere.example' } });
  });

  it("serve the organization's install manifest", async () => {
    const { client } = testApp();
    const manifest = await client().json<{ short_name: string; theme_color: string; icons: unknown[] }>('/api/manifest.webmanifest');
    expect(manifest.body).toMatchObject({ short_name: 'CRT Respond', theme_color: '#336', icons: [{ src: '/api/icon/192.png' }, { src: '/api/icon/512.png' }] });
  });
});

describe('dev sign-in', () => {
  it('signs a member in by email, as found by their provider', async () => {
    const crt = testApp().client();
    expect((await crt.json<SessionResponse>('/api/auth/session')).body.session).toBeNull();
    const res = await crt.signIn('Avery.Lindqvist@crt.example.org', { tier: 'manage' });
    expect(res.status).toBe(200);
    const expected = { userId: 'kcsara:1', name: 'Avery Lindqvist', email: 'avery.lindqvist@crt.example.org', personRef: 'kcsara:1', tier: 'manage', class: 'member', admin: false };
    expect(((await res.json()) as SessionResponse).session).toEqual(expected);
    expect((await crt.json<SessionResponse>('/api/auth/session')).body.session).toEqual(expected);
  });

  it('takes the tier from their groups unless one is chosen', async () => {
    const seed = testSeed();
    seed.organizations[1]!.memberTiers = { Medical: 'manage' };
    const app = () => testApp({ organizations: OrganizationStore.memory(seed) }).client();
    const bo = app();
    await bo.signIn('bo.okafor@crt.example.org', { tier: undefined });
    expect((await bo.json<SessionResponse>('/api/auth/session')).body.session?.tier).toBe('manage');
    const chosen = app();
    await chosen.signIn('bo.okafor@crt.example.org', { tier: 'manage' });
    expect((await chosen.json<SessionResponse>('/api/auth/session')).body.session?.tier).toBe('manage');
    const visitor = app();
    await visitor.signIn('pat@gmail.example', { name: 'Pat Visitor', tier: undefined });
    expect((await visitor.json<SessionResponse>('/api/auth/session')).body.session?.tier).toBe('respond');
  });

  it("signs someone from another organization in on this site's terms", async () => {
    const crt = testApp().client();
    // Rowan's email is RMR's; signing in on CRT's site, they're CRT's for this session.
    await crt.signIn('rowan.pike@rmr.example.org');
    expect((await crt.json<SessionResponse>('/api/auth/session')).body.session).toMatchObject({ personRef: 'kcsara:5', name: 'Rowan Pike' });
    // The session is CRT's site's only.
    expect((await crt.json<SessionResponse>('/api/auth/session', { host: 'rmr.localhost' })).body.session).toBeNull();
    expect((await crt.request('/api/v1/organizations/org-rmr/members?query=pike', { host: 'rmr.localhost' })).status).toBe(401);
  });

  it("takes someone the provider doesn't know only with a name, as a visitor", async () => {
    const crt = testApp().client();
    const refused = await crt.signIn('pat@gmail.example');
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { error: string }).error).toMatch(/isn't in the member directory/);
    await crt.signIn('pat@gmail.example', { name: 'Pat Visitor', class: 'external' });
    expect((await crt.json<SessionResponse>('/api/auth/session')).body.session).toMatchObject({ personRef: 'adhoc:pat@gmail.example', name: 'Pat Visitor', class: 'external' });
  });

  it('refuses a bad request, and signs out', async () => {
    const crt = testApp().client();
    expect((await crt.signIn('not-an-email')).status).toBe(400);
    expect((await crt.signIn('bo.okafor@crt.example.org', { tier: 'boss' })).status).toBe(400);
    await crt.signIn('bo.okafor@crt.example.org');
    expect((await crt.request('/api/auth/logout', { method: 'POST' })).status).toBe(200);
    expect((await crt.json<SessionResponse>('/api/auth/session')).body.session).toBeNull();
  });

  it('impersonates a person ref, and gives a token instead of a cookie when asked', async () => {
    const crt = testApp().client();
    expect((await crt.signIn('x@harness.example', { personRef: 'kcsara:101' })).status).toBe(400);
    await crt.signIn('x@harness.example', { name: 'Alice Adams', personRef: 'kcsara:101', tier: 'manage' });
    expect((await crt.json<SessionResponse>('/api/auth/session')).body.session).toMatchObject({ personRef: 'kcsara:101', name: 'Alice Adams', tier: 'manage' });

    const pane = testApp();
    const res = await pane.app.request('/api/auth/dev?token=1', { method: 'POST', headers: { host: 'crt.localhost', 'content-type': 'application/json' }, body: JSON.stringify({ email: 'bo.okafor@crt.example.org', tier: 'respond', class: 'member' }) });
    expect(res.headers.get('set-cookie')).toBeNull();
    const { token } = (await res.json()) as { token: string };
    const asPane = await pane.app.request(`/api/auth/session?session=${token}`, { headers: { host: 'crt.localhost' } });
    expect(((await asPane.json()) as SessionResponse).session?.personRef).toBe('kcsara:3');
    // Production builds take no token.
    const prod = testApp({ devSignIn: false, sessions: pane.sessions });
    const asProd = await prod.app.request(`/api/auth/session?session=${token}`, { headers: { host: 'crt.localhost' } });
    expect(((await asProd.json()) as SessionResponse).session).toBeNull();
  });

  it('keeps the sync connection to people signed in on this site', async () => {
    const crt = testApp().client();
    expect((await crt.request('/api/sync')).status).toBe(401);
    // Identity in the URL, as the dev auth once took it, counts for nothing.
    expect((await crt.request('/api/sync?user=alice&tier=manage&person=kcsara:1')).status).toBe(401);
  });

  it("doesn't exist unless asked for", async () => {
    const crt = testApp({ devSignIn: false }).client();
    expect((await crt.signIn('bo.okafor@crt.example.org')).status).toBe(404);
    expect((await crt.json<BootstrapResponse>('/api/bootstrap')).body.config.devSignIn).toBe(false);
  });
});
