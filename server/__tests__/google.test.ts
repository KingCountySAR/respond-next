import { describe, expect, it } from 'vitest';
import { OrganizationSeed, type AdminSignInProvidersResponse, type BootstrapResponse, type SessionResponse } from '@sync/domain';
import { GoogleSignIn, SignInProviders } from '../src/google';
import { OrganizationStore } from '../src/organizations';
import { CRT_HOST, testApp, testSeed } from './helpers';

const CLIENT_ID = 'sync-app.apps.googleusercontent.com';
const TOKEN = 'https://oauth2.googleapis.com/token';

/** The seed, with the umbrella's sign-in provider: CRT's site signs in through it too. */
function seedWithSignIn(): OrganizationSeed {
  const seed = testSeed();
  return OrganizationSeed.parse({
    ...seed,
    signInProviders: [{ id: 'google', kind: 'google', clientId: CLIENT_ID, clientSecret: 'shh' }],
    organizations: seed.organizations.map((o) => (o.id === 'org-cvsc' ? { ...o, signInProvider: 'google' } : o)),
  });
}

/** An ID token as Google's token endpoint sends it; its signature isn't checked. */
const idToken = (claims: Record<string, unknown>) => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;

/**
 * A server whose sign-in provider talks to a fake Google token endpoint, which answers with an ID
 * token for `who` (with the nonce the sign-in sent) unless told otherwise.
 */
function setup(who: Record<string, unknown> = { email: 'Bo.Okafor@crt.example.org', email_verified: true }) {
  const organizations = OrganizationStore.memory(seedWithSignIn());
  let nonce = '';
  const seen: { url: string; body?: URLSearchParams }[] = [];
  const fake: typeof fetch = async (input, init) => {
    const url = String(input);
    seen.push({ url, body: init?.body as URLSearchParams | undefined });
    if (url !== TOKEN) return new Response('not found', { status: 404 });
    return Response.json({ id_token: idToken({ iss: 'https://accounts.google.com', aud: CLIENT_ID, exp: Date.now() / 1000 + 300, nonce, ...who }) });
  };
  const signIn = new SignInProviders(organizations, (config) => new GoogleSignIn({ ...config, fetch: fake }));
  const { app } = testApp({ organizations, signIn });
  const request = (path: string, cookie?: string) => app.request(path, { headers: { host: CRT_HOST, ...(cookie && { cookie }) } });

  /** Off to Google: where to, and the cookie this site keeps meanwhile. */
  const start = async (then = '/mission/a1') => {
    const res = await request(`/api/auth/login?then=${encodeURIComponent(then)}`);
    const to = new URL(res.headers.get('location')!);
    nonce = to.searchParams.get('nonce')!;
    return { res, to, state: to.searchParams.get('state')!, cookie: res.headers.get('set-cookie')!.split(';')[0]! };
  };
  /** Back from Google; the session cookie, if one was set. */
  const finish = async (state: string, cookie: string | undefined, query = 'code=c1') => {
    const res = await request(`/api/auth/callback?${query}&state=${state}`, cookie);
    const session = res.headers.getSetCookie().find((c) => c.startsWith('sync_session='))?.split(';')[0];
    return { res, location: res.headers.get('location'), session };
  };
  return { app, organizations, request, start, finish, seen };
}

describe('sign-in with Google', () => {
  it('signs in a member the directory knows, and goes back where they were', async () => {
    const { start, finish, request, seen } = setup();
    const { to, state, cookie } = await start();
    expect(to.origin + to.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(to.searchParams)).toMatchObject({ client_id: CLIENT_ID, response_type: 'code', scope: 'openid email profile', redirect_uri: `http://${CRT_HOST}/api/auth/callback`, code_challenge_method: 'S256' });

    const back = await finish(state, cookie);
    expect(back.location).toBe('/mission/a1');
    expect(back.session).toBeTruthy();
    // The code went to Google with this app's client secret and the PKCE verifier.
    const token = seen.find((s) => s.url === TOKEN)!;
    expect(token.body?.get('client_secret')).toBe('shh');
    expect(token.body?.get('code_verifier')).toBeTruthy();
    const session = (await (await request('/api/auth/session', back.session)).json()) as SessionResponse;
    expect(session.session).toMatchObject({ personRef: 'kcsara:3', name: 'Bo Okafor', email: 'bo.okafor@crt.example.org', class: 'member' });
  });

  it("refuses someone the member directory doesn't know", async () => {
    const { start, finish } = setup({ email: 'stranger@example.org', email_verified: true });
    const { state, cookie } = await start();
    const back = await finish(state, cookie);
    expect(back.session).toBeUndefined();
    expect(back.location).toBe(`/?signinError=${encodeURIComponent("stranger@example.org isn't in the member directory.")}`);
  });

  it('refuses an unverified email, a token for another client or sign-in, and a sign-in another browser started', async () => {
    for (const who of [
      { email: 'bo.okafor@crt.example.org', email_verified: false },
      { email: 'bo.okafor@crt.example.org', email_verified: true, aud: 'someone-else' },
      { email: 'bo.okafor@crt.example.org', email_verified: true, nonce: 'another' },
      { email: 'bo.okafor@crt.example.org', email_verified: true, exp: Date.now() / 1000 - 60 },
    ]) {
      const s = setup(who);
      const started = await s.start();
      const back = await s.finish(started.state, started.cookie);
      expect(back.session).toBeUndefined();
      expect(back.location).toMatch(/^\/\?signinError=Sign-in%20failed/);
    }

    const elsewhere = setup();
    const started = await elsewhere.start();
    const back = await elsewhere.finish(started.state, undefined);
    expect(back.session).toBeUndefined();
    expect(back.location).toBe(`/?signinError=${encodeURIComponent('That sign-in had expired. Please try again.')}`);
  });

  it('passes on a cancelled sign-in', async () => {
    const { start, finish } = setup();
    const { state, cookie } = await start();
    const back = await finish(state, cookie, 'error=access_denied');
    expect(back.location).toBe(`/?signinError=${encodeURIComponent('Sign-in was cancelled.')}`);
  });

  it('only goes back to a path on this site', async () => {
    const { start, finish } = setup();
    const { state, cookie } = await start('//evil.example.org/x');
    expect((await finish(state, cookie)).location).toBe('/');
  });

  it("is offered where the site's organization, or one above it, has a provider", async () => {
    const { request } = setup();
    expect(((await (await request('/api/bootstrap')).json()) as BootstrapResponse).config.googleSignIn).toBe(true);
    const without = testApp();
    const res = await without.app.request('/api/bootstrap', { headers: { host: CRT_HOST } });
    expect(((await res.json()) as BootstrapResponse).config.googleSignIn).toBe(false);
    expect((await without.app.request('/api/auth/login', { headers: { host: CRT_HOST } })).status).toBe(404);
  });
});

describe('sign-in providers', () => {
  it('are for site admins to manage, their secrets never sent back', async () => {
    const { client } = testApp({ organizations: OrganizationStore.memory(seedWithSignIn()) });
    const admin = client();
    await admin.signIn('admin@cvsc.example.org', { name: 'Site Admin' });
    const list = await admin.json<AdminSignInProvidersResponse>('/api/admin/sign-in-providers');
    expect(list.body).toEqual({ signInProviders: [{ id: 'google', kind: 'google', clientId: CLIENT_ID, hasClientSecret: true }], usedBy: { google: ['org-cvsc'] } });

    // Saved without a secret, it keeps the one it had.
    const saved = await admin.json<{ signInProvider: unknown }>('/api/admin/sign-in-providers/google', { method: 'PUT', body: { id: 'google', kind: 'google', clientId: 'renamed' } });
    expect(saved.body.signInProvider).toEqual({ id: 'google', kind: 'google', clientId: 'renamed', hasClientSecret: true });
    expect((await admin.request('/api/admin/sign-in-providers/google', { method: 'DELETE' })).status).toBe(400);

    const member = client();
    await member.signIn('bo.okafor@crt.example.org');
    expect((await member.request('/api/admin/sign-in-providers')).status).toBe(403);
  });
});
