import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createNodeWebSocket } from '@hono/node-ws';
import { PROTOCOL } from '@sync/core';
import {
  MEMBER_QUERY_MAX,
  MEMBER_QUERY_MIN,
  SavedLocation,
  isValidPoint,
  viewerOfSession,
  type AdminMemberProvidersResponse,
  type AdminOrganizationsResponse,
  type BootstrapResponse,
  type Organization,
  type Session,
  type SessionResponse,
  type SiteAdminsResponse,
} from '@sync/domain';
import type { Hub } from '@sync/server';
import type { LocationCatalog } from './locations';
import type { MemberProviders } from './memberProviders';
import { hostnameOf, type OrganizationStore } from './organizations';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, type SessionData, type SessionStore } from './sessions';
import { devSignIn } from './signIn';
import type { WeatherSource } from './weather';

export interface SyncAppOptions {
  /** The organizations: each request's site is the one its hostname belongs to. */
  organizations: OrganizationStore;
  sessions: SessionStore;
  /** Offer `POST /api/auth/dev` (sign in as anyone) and `?session=` tokens. Never on an internet-facing site. */
  devSignIn: boolean;
  /** Mark the session cookie Secure (production, behind HTTPS). */
  secureCookies?: boolean;
  buildId?: string;
  /** Member search and photos (for adding someone else to an activity), and sign-in lookups. */
  members?: MemberProviders;
  /** The saved-location catalog. */
  locations?: LocationCatalog;
  /** The ops dashboard's forecasts. */
  weather?: WeatherSource;
  /** Dev-only JSON view of an activity's server state. Leave unset in production. */
  debugActivity?(activityId: string, view: string): Promise<unknown>;
}

type Env = { Variables: { site: Organization; session: SessionData } };

export function createSyncApp(hub: Hub, options: SyncAppOptions) {
  const { organizations: orgs, sessions } = options;
  const app = new Hono<Env>();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get('/health', (c) => c.json({ ok: true }));

  // Everything else under /api is for one site, by hostname.
  app.use('/api/*', async (c, next) => {
    const site = orgs.forHost(c.req.header('host'));
    if (!site) return c.json({ error: `No site is set up for ${hostnameOf(c.req.header('host'))}` }, 404);
    c.set('site', site);
    await next();
  });

  /**
   * The signed-in session, if it was started on this site. With the dev sign-in it may also come from
   * `?session=`, so one browser can hold several (the harness's panes).
   */
  const sessionOf = async (c: Context<Env>): Promise<SessionData | undefined> => {
    const id = (options.devSignIn && c.req.query('session')) || getCookie(c, SESSION_COOKIE);
    const data = id ? await sessions.get(id) : undefined;
    return data?.orgId === c.get('site').id ? data : undefined;
  };
  const toSession = ({ orgId: _, ...data }: SessionData): Session => ({ ...data, admin: orgs.isAdmin(data.email) });
  /** Routes below it need a session. */
  const signedIn = async (c: Context<Env>, next: () => Promise<void>) => {
    const session = await sessionOf(c);
    if (!session) return c.json({ error: 'Not signed in' }, 401);
    c.set('session', session);
    await next();
  };

  app.get('/api/bootstrap', (c) =>
    c.json({ config: orgs.siteConfig(c.get('site'), { devSignIn: options.devSignIn, buildId: options.buildId ?? 'dev' }) } satisfies BootstrapResponse),
  );

  // The site's app icon and install manifest, as the legacy app served them per hostname. The icon
  // is served as stored: browsers scale it to the size they need.
  app.get('/api/icon', (c) => {
    const icon = orgs.brandOf(c.get('site').id).icon;
    if (!icon) return c.json({ error: 'not_found' }, 404);
    if (icon.startsWith('https://')) return c.redirect(icon);
    const [, type, data] = /^data:([^;]+);base64,(.*)$/s.exec(icon) ?? [];
    if (!type || data === undefined) return c.json({ error: 'not_found' }, 404);
    return c.body(new Uint8Array(Buffer.from(data, 'base64')), 200, { 'content-type': type, 'cache-control': 'no-cache' });
  });
  app.get('/api/manifest.webmanifest', (c) => {
    const site = c.get('site');
    const brand = orgs.brandOf(site.id);
    const manifest = {
      name: `${site.title} Respond`,
      short_name: `${site.shortTitle} Respond`,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: brand.primary,
      icons: brand.icon ? [{ src: '/api/icon', sizes: '512x512', purpose: 'any' }] : [],
    };
    return c.body(JSON.stringify(manifest), 200, { 'content-type': 'application/manifest+json', 'cache-control': 'no-cache' });
  });

  // Sign-in. Sessions are per hostname: the cookie isn't shared with other sites.
  app.get('/api/auth/session', async (c) => {
    const data = await sessionOf(c);
    return c.json({ session: data ? toSession(data) : null } satisfies SessionResponse);
  });
  if (options.devSignIn) {
    app.post('/api/auth/dev', async (c) => {
      const result = await devSignIn(options.members, c.get('site'), await c.req.json().catch(() => undefined));
      if (!result.ok) return c.json({ error: result.error }, result.status);
      const id = await sessions.create(result.session);
      // `?token=1`: the session id comes back for `?session=`, and no cookie is set.
      if (c.req.query('token') === '1') return c.json({ session: toSession(result.session), token: id });
      setCookie(c, SESSION_COOKIE, id, { httpOnly: true, secure: options.secureCookies, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL_SECONDS });
      return c.json({ session: toSession(result.session) } satisfies SessionResponse);
    });
  }
  app.post('/api/auth/logout', async (c) => {
    const id = getCookie(c, SESSION_COOKIE);
    if (id) await sessions.remove(id);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ status: 'ok' });
  });

  app.get(
    '/api/sync',
    signedIn,
    upgradeWebSocket((c) => {
      const offered = (c.req.header('sec-websocket-protocol') ?? '').split(',').map((p) => p.trim());
      const viewer = viewerOfSession(toSession(c.get('session')));
      let handlers: ReturnType<Hub['connect']> | undefined;
      return {
        onOpen(_evt, ws) {
          if (!offered.includes(PROTOCOL)) {
            ws.close(4400, `expected subprotocol ${PROTOCOL}`);
            return;
          }
          handlers = hub.connect({
            viewer,
            send: (text) => {
              if (ws.readyState === 1) ws.send(text);
            },
            close: (code, reason) => ws.close(code, reason),
          });
        },
        onMessage(evt) {
          if (typeof evt.data === 'string') handlers?.message(evt.data);
        },
        onClose() {
          handlers?.close();
        },
      };
    }),
  );

  // The legacy member routes, for any organization: the add-responder search covers partners too.
  const { members } = options;
  if (members) {
    app.get('/api/v1/organizations/:orgId/members', signedIn, async (c) => {
      const query = c.req.query('query')?.trim() ?? '';
      if (query.length < MEMBER_QUERY_MIN || query.length > MEMBER_QUERY_MAX) return c.json({ error: `Query must be between ${MEMBER_QUERY_MIN} and ${MEMBER_QUERY_MAX} characters` }, 400);
      try {
        const list = await members.search(c.req.param('orgId')!, query);
        if (!list) return c.json({ error: 'Organization not found' }, 404);
        return c.json({ data: list });
      } catch (err) {
        console.error('member search failed', err);
        return c.json({ error: 'Failed to search members' }, 502);
      }
    });
    app.get('/api/v1/organizations/:orgId/members/:memberId/photo', signedIn, async (c) => {
      try {
        const photo = await members.photo(c.req.param('orgId')!, c.req.param('memberId')!);
        if (!photo) return c.json({ status: 'not found' }, 404);
        return c.body(photo.data.slice().buffer as ArrayBuffer, 200, { 'content-type': photo.contentType });
      } catch (err) {
        console.error('member photo failed', err);
        return c.json({ error: 'Failed to load the photo' }, 502);
      }
    });
  }

  // The legacy saved-location routes.
  const { locations } = options;
  if (locations) {
    app.get('/api/v1/locations', signedIn, async (c) => c.json({ status: 'ok', data: await locations.search(c.req.query('query') ?? '') }));
    app.put('/api/v1/locations', signedIn, async (c) => {
      const parsed = SavedLocation.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return c.json({ error: issue ? `${issue.path.join('.') || 'location'}: ${issue.message}` : 'Invalid location' }, 400);
      }
      await locations.put(parsed.data);
      return c.json({ status: 'ok' });
    });
    app.delete('/api/v1/locations/:id', signedIn, async (c) => {
      await locations.remove(c.req.param('id')!);
      return c.json({ status: 'ok' });
    });
  }

  // The legacy weather route, a proxy for NOAA's forecast.
  const { weather } = options;
  if (weather) {
    app.get('/api/weather', signedIn, async (c) => {
      const lat = Number(c.req.query('lat'));
      const lon = Number(c.req.query('lon'));
      if (!isValidPoint(lat, lon)) return c.json({ error: 'Invalid coordinates.' }, 400);
      const result = await weather.forecast(lat, lon);
      return result.ok ? c.json(result.report) : c.json({ error: result.error }, 502);
    });
  }

  // Organization admin: site admins see everything; an organization's admins, it and those under it.
  app.get('/api/admin/organizations', signedIn, (c) => {
    const { email } = c.get('session');
    const editable = orgs.editableBy(email);
    if (!editable.length) return c.json({ error: 'Not an admin' }, 403);
    return c.json({
      organizations: editable,
      all: orgs.all().map((o) => ({ id: o.id, title: o.title })),
      memberProviders: orgs.memberProviders().map((p) => p.id),
      siteAdmin: orgs.isSiteAdmin(email),
    } satisfies AdminOrganizationsResponse);
  });
  app.put('/api/admin/organizations/:id', signedIn, async (c) => {
    const body = (await c.req.json().catch(() => undefined)) as { id?: unknown } | undefined;
    if (body?.id !== c.req.param('id')) return c.json({ error: "The organization's id doesn't match the URL" }, 400);
    const result = await orgs.save(body, c.get('session').email);
    return result.ok ? c.json({ organization: result.saved }) : c.json({ error: result.error }, result.status);
  });
  app.delete('/api/admin/organizations/:id', signedIn, async (c) => {
    const result = await orgs.remove(c.req.param('id')!, c.get('session').email);
    return result.ok ? c.json({ status: 'ok' }) : c.json({ error: result.error }, result.status);
  });
  app.get('/api/admin/site-admins', signedIn, (c) => {
    if (!orgs.isSiteAdmin(c.get('session').email)) return c.json({ error: 'Only site admins can do that' }, 403);
    return c.json(orgs.siteAdmins() satisfies SiteAdminsResponse);
  });
  app.put('/api/admin/site-admins', signedIn, async (c) => {
    const { email } = c.get('session');
    if (!orgs.isSiteAdmin(email)) return c.json({ error: 'Only site admins can do that' }, 403);
    const body = (await c.req.json().catch(() => undefined)) as { stored?: unknown } | undefined;
    const stored = Array.isArray(body?.stored) ? body.stored : undefined;
    if (!stored?.every((e): e is string => typeof e === 'string' && /^[^@\s]+@[^@\s]+$/.test(e.trim()))) return c.json({ error: 'stored: a list of email addresses' }, 400);
    await orgs.setSiteAdmins(stored);
    return c.json(orgs.siteAdmins() satisfies SiteAdminsResponse);
  });

  // Member providers: site admins only. Secrets go in and are never sent back.
  app.get('/api/admin/member-providers', signedIn, (c) => {
    if (!orgs.isSiteAdmin(c.get('session').email)) return c.json({ error: 'Only site admins can do that' }, 403);
    return c.json({ memberProviders: orgs.memberProviders(), usedBy: orgs.providerUsers() } satisfies AdminMemberProvidersResponse);
  });
  app.put('/api/admin/member-providers/:id', signedIn, async (c) => {
    const body = (await c.req.json().catch(() => undefined)) as { id?: unknown } | undefined;
    if (body?.id !== c.req.param('id')) return c.json({ error: "The member provider's id doesn't match the URL" }, 400);
    const result = await orgs.saveProvider(body, c.get('session').email);
    return result.ok ? c.json({ memberProvider: result.saved }) : c.json({ error: result.error }, result.status);
  });
  app.delete('/api/admin/member-providers/:id', signedIn, async (c) => {
    const result = await orgs.removeProvider(c.req.param('id')!, c.get('session').email);
    return result.ok ? c.json({ status: 'ok' }) : c.json({ error: result.error }, result.status);
  });

  const { debugActivity } = options;
  if (debugActivity) {
    app.get('/api/debug/activities/:id', async (c) => c.json(await debugActivity(c.req.param('id'), c.req.query('view') ?? 'command')));
  }

  // Unknown API paths get a JSON 404 rather than the UI's index.html fallback.
  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

  return { app, injectWebSocket };
}
