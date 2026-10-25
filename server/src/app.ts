import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createNodeWebSocket } from '@hono/node-ws';
import { PROTOCOL, type Rec, type Viewer } from '@sync/core';
import {
  ACTIVITY_ARCHIVE_ID,
  MEMBER_QUERY_MAX,
  activityOfScope,
  MEMBER_QUERY_MIN,
  SavedLocation,
  isValidPoint,
  viewerOfSession,
  type ActivitiesResponse,
  type ActivityResponse,
  type AdminMemberProvidersResponse,
  type AdminOrganizationsResponse,
  type AdminSignInProvidersResponse,
  type BootstrapResponse,
  type GrantResponse,
  type Organization,
  type Session,
  type SessionResponse,
  type SiteAdminsResponse,
} from '@sync/domain';
import type { Hub } from '@sync/server';
import type { GrantStore } from './grants';
import type { LocationCatalog } from './locations';
import type { MemberProviders } from './memberProviders';
import type { GoogleSignIn, SignInStart } from './google';
import { hasMaskable, iconSizeOf, iconSourceFor, IconRenderer } from './icons';
import { hostnameOf, type OrganizationStore } from './organizations';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, type SessionData, type SessionStore } from './sessions';
import { devSignIn, memberSignIn, refreshSession, tierOn, type People } from './signIn';
import type { WeatherSource } from './weather';

export interface SyncAppOptions {
  /** The organizations: each request's site is the one its hostname belongs to. */
  organizations: OrganizationStore;
  sessions: SessionStore;
  /** Each site's Google sign-in, from its sign-in provider. */
  signIn?: { forSite(orgId: string): GoogleSignIn | undefined };
  /**
   * One Google callback for every site, e.g. http://localhost:4000/api/auth/callback on a dev machine
   * (Google won't take crt.localhost). It sends the code on to the site that started the sign-in,
   * which finishes it. Unset: each site's own.
   */
  signInCallback?: string;
  /** Makes the app icons at the sizes asked for; tests pass one that fetches nothing. */
  icons?: IconRenderer;
  /** Offer `POST /api/auth/dev` (sign in as anyone) and `?session=` tokens. Never on an internet-facing site. */
  devSignIn: boolean;
  /** Mark the session cookie Secure (production, behind HTTPS). */
  secureCookies?: boolean;
  buildId?: string;
  /** Member search and photos (for adding someone else to an activity), and sign-in lookups. */
  members?: MemberProviders;
  /** Tiers granted by managers, beside what members' groups give. */
  grants?: GrantStore;
  /** The saved-location catalog. */
  locations?: LocationCatalog;
  /** The ops dashboard's forecasts. */
  weather?: WeatherSource;
  /** Dev-only JSON view of an activity's server state. Leave unset in production. */
  debugActivity?(activityId: string, view: string): Promise<unknown>;
}

type Env = { Variables: { site: Organization; session: SessionData } };

/** Who someone is on one activity: as signed in, unless they have a grant there. */
function viewerOn(session: SessionData, activityId: string): Viewer {
  const viewer = viewerOfSession(session);
  const tier = tierOn(session, activityOfScope(activityId));
  return tier === viewer.tier ? viewer : { ...viewer, tier };
}

export function createSyncApp(hub: Hub, options: SyncAppOptions) {
  const { organizations: orgs, sessions } = options;
  const iconRenderer = options.icons ?? new IconRenderer();
  const app = new Hono<Env>();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get('/health', (c) => c.json({ ok: true }));

  const scheme = options.secureCookies ? 'https' : 'http';
  const failed = (c: Context, error: string) => c.redirect(`/?signinError=${encodeURIComponent(error)}`);

  // With one Google callback for every site, the sign-in's state names the site that started it (its
  // host), and the callback sends the code there: only to a site of ours, and the code is no use
  // without the verifier in that site's cookie. Ahead of the site lookup, so the callback's host
  // needn't be a site.
  app.get('/api/auth/callback', async (c, next) => {
    const tag = options.signInCallback && c.req.query('state')?.split('.')[1];
    const site = tag ? Buffer.from(tag, 'base64url').toString('utf8') : undefined;
    if (!site || hostnameOf(site) === hostnameOf(c.req.header('host'))) return next();
    if (!/^[a-z0-9.-]+(:\d+)?$/i.test(site) || !orgs.forHost(site)) return failed(c, "That sign-in started on a site that isn't here.");
    return c.redirect(`${scheme}://${site}/api/auth/callback?${new URL(c.req.url).searchParams}`);
  });

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
  const people: People = { members: options.members, grants: options.grants };
  const toSession = ({ orgId: _, grants: _grants, ...data }: SessionData): Session => ({ ...data, admin: orgs.isAdmin(data.email) });
  /** Routes below it need a session. */
  const signedIn = async (c: Context<Env>, next: () => Promise<void>) => {
    const session = await sessionOf(c);
    if (!session) return c.json({ error: 'Not signed in' }, 401);
    c.set('session', session);
    await next();
  };

  app.get('/api/bootstrap', (c) =>
    c.json({ config: orgs.siteConfig(c.get('site'), { devSignIn: options.devSignIn, googleSignIn: !!options.signIn?.forSite(c.get('site').id), buildId: options.buildId ?? 'dev' }) } satisfies BootstrapResponse),
  );

  // The site's app icon and install manifest, as the legacy app served them per hostname: each icon
  // at the sizes the app uses, made from the nearest stored one (icons.ts).
  const serveIcon = (maskable: boolean) => async (c: Context<Env>) => {
    const size = iconSizeOf(c.req.param('size') ?? '');
    const icons = orgs.brandOf(c.get('site').id).icon;
    const source = size && icons && iconSourceFor(icons, size, maskable);
    const icon = source ? await iconRenderer.render(source, size).catch(() => undefined) : undefined;
    if (!icon) return c.json({ error: 'not_found' }, 404);
    if (c.req.header('if-none-match') === icon.etag) return c.body(null, 304);
    return c.body(icon.body, 200, { 'content-type': icon.type, 'cache-control': 'no-cache', etag: icon.etag });
  };
  app.get('/api/icon/maskable/:size', serveIcon(true));
  app.get('/api/icon/:size', serveIcon(false));
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
      // Maskable ones only when there's a maskable icon: one that isn't kept to the safe zone, offered
      // as maskable, gets clipped.
      icons: brand.icon
        ? (hasMaskable(brand.icon) ? (['any', 'maskable'] as const) : (['any'] as const)).flatMap((purpose) =>
            ([192, 512] as const).map((s) => ({ src: `/api/icon/${purpose === 'maskable' ? 'maskable/' : ''}${s}.png`, sizes: `${s}x${s}`, purpose })),
          )
        : [],
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
      const result = await devSignIn(people, c.get('site'), await c.req.json().catch(() => undefined));
      if (!result.ok) return c.json({ error: result.error }, result.status);
      const id = await sessions.create(result.session);
      // `?token=1`: the session id comes back for `?session=`, and no cookie is set.
      if (c.req.query('token') === '1') return c.json({ session: toSession(result.session), token: id });
      setCookie(c, SESSION_COOKIE, id, { httpOnly: true, secure: options.secureCookies, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL_SECONDS });
      return c.json({ session: toSession(result.session) } satisfies SessionResponse);
    });
  }
  // Sign-in with Google, through the site's provider: off to Google, and back with a code. What's
  // needed to finish (the PKCE verifier among it) waits in a cookie for this site only; a failure
  // goes back to the app as `?signinError=`.
  const signInOf = (c: Context<Env>) => options.signIn?.forSite(c.get('site').id);
  const LOGIN_COOKIE = 'sync_login';
  const callbackOf = (c: Context<Env>) => options.signInCallback ?? `${scheme}://${c.req.header('host')}/api/auth/callback`;
  // Only a path on this site, never another site (//host).
  const pathOnly = (then: string | undefined) => (then && /^\/(?![/\\])/.test(then) ? then : '/');

  app.get('/api/auth/login', async (c) => {
    const google = signInOf(c);
    if (!google) return c.json({ error: 'This site has no sign-in provider' }, 404);
    const { url, keep } = google.start(callbackOf(c), options.signInCallback && Buffer.from(c.req.header('host') ?? '').toString('base64url'));
    const value = Buffer.from(JSON.stringify({ ...keep, then: pathOnly(c.req.query('then')) })).toString('base64url');
    setCookie(c, LOGIN_COOKIE, value, { httpOnly: true, secure: options.secureCookies, sameSite: 'Lax', path: '/api/auth', maxAge: 600 });
    return c.redirect(url);
  });
  app.get('/api/auth/callback', async (c) => {
    const raw = getCookie(c, LOGIN_COOKIE);
    deleteCookie(c, LOGIN_COOKIE, { path: '/api/auth' });
    let kept: (SignInStart & { then: string }) | undefined;
    try {
      kept = raw ? (JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as SignInStart & { then: string }) : undefined;
    } catch {
      kept = undefined;
    }
    if (!kept || kept.state !== c.req.query('state')) return failed(c, 'That sign-in had expired. Please try again.');
    if (c.req.query('error')) return failed(c, c.req.query('error_description') ?? 'Sign-in was cancelled.');
    const google = signInOf(c);
    if (!google) return failed(c, 'This site has no sign-in provider.');
    let email: string;
    try {
      ({ email } = await google.finish(c.req.query('code') ?? '', callbackOf(c), kept));
    } catch (err) {
      console.warn('sign-in failed', err);
      return failed(c, 'Sign-in failed. Please try again.');
    }
    const result = await memberSignIn(people, c.get('site'), email);
    if (!result.ok) return failed(c, result.error);
    const id = await sessions.create(result.session);
    setCookie(c, SESSION_COOKIE, id, { httpOnly: true, secure: options.secureCookies, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL_SECONDS });
    return c.redirect(pathOnly(kept.then));
  });
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
      const session = c.get('session');
      const viewer = viewerOfSession(session);
      let handlers: ReturnType<Hub['connect']> | undefined;
      return {
        onOpen(_evt, ws) {
          if (!offered.includes(PROTOCOL)) {
            ws.close(4400, `expected subprotocol ${PROTOCOL}`);
            return;
          }
          handlers = hub.connect({
            viewer,
            // Undefined, the usual case, without a grant there.
            viewerIn: (activityId) => {
              const there = viewerOn(session, activityId);
              return there.tier === viewer.tier ? undefined : there;
            },
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

  // Activities over HTTP, for reports and anyone else downloading them: every activity's summary,
  // from the archive, and one activity as the viewer sees it, once. A completed activity's page reads
  // it this way rather than subscribing.
  app.get('/api/activities', signedIn, async (c) => {
    const { records } = await hub.read(ACTIVITY_ARCHIVE_ID, viewerOfSession(c.get('session')));
    const data = records.filter((r) => r.type === 'activitySummary').map(({ version: _, ...summary }: Rec) => summary as unknown as ActivitiesResponse['data'][number]);
    return c.json({ data } satisfies ActivitiesResponse);
  });
  app.get('/api/activities/:activityId', signedIn, async (c) => {
    const activityId = c.req.param('activityId')!;
    // The list and archive are scopes, not activities.
    if (activityId.startsWith('$')) return c.json({ error: 'not_found' }, 404);
    const read = await hub.read(activityId, viewerOn(c.get('session'), activityId));
    if (read.version === 0) return c.json({ error: 'not_found' }, 404);
    return c.json({ activityId, ...read } satisfies ActivityResponse);
  });

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

  // Tier grants: someone managing an activity may let a person on its roster manage it too, and
  // take that away. It counts on that activity only, at once: their sessions are
  // brought up to date and their connections closed, so their clients reconnect as who they are now.
  const { grants } = options;
  if (grants) {
    const changed = async (personRef: string) => {
      await sessions.updatePerson(personRef, (data) => refreshSession(people, data));
      hub.disconnectWhere((viewer) => viewer.userId === personRef);
    };
    const grantPath = '/api/activities/:activityId/grants/:personRef';
    const managing = async (c: Context<Env>, next: () => Promise<void>) => {
      if (tierOn(c.get('session'), c.req.param('activityId')!) !== 'manage') return c.json({ error: 'Only a manager of this activity can grant tiers' }, 403);
      await next();
    };
    app.get(grantPath, signedIn, managing, async (c) => c.json({ grant: (await grants.get(c.req.param('personRef')!, c.req.param('activityId')!)) ?? null } satisfies GrantResponse));
    app.put(grantPath, signedIn, managing, async (c) => {
      const { activityId, personRef } = c.req.param() as { activityId: string; personRef: string };
      const body = (await c.req.json().catch(() => undefined)) as { tier?: unknown } | undefined;
      if (body?.tier !== 'manage') return c.json({ error: 'tier: manage' }, 400);
      const roster = (await hub.actor(activityId)).projectedRecords('manage');
      if (!roster.some((r) => r.type === 'participant' && (r as { personRef?: string }).personRef === personRef)) return c.json({ error: `${personRef} isn't on that activity's roster` }, 400);
      const grant = { tier: body.tier, grantedBy: c.get('session').email, grantedAt: Date.now() } as const;
      await grants.set(personRef, activityId, grant);
      await changed(personRef);
      return c.json({ grant } satisfies GrantResponse);
    });
    app.delete(grantPath, signedIn, managing, async (c) => {
      await grants.remove(c.req.param('personRef')!, c.req.param('activityId')!);
      await changed(c.req.param('personRef')!);
      return c.json({ grant: null } satisfies GrantResponse);
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
      signInProviders: orgs.signInProviders().map((p) => p.id),
      siteAdmin: orgs.isSiteAdmin(email),
    } satisfies AdminOrganizationsResponse);
  });
  app.put('/api/admin/organizations/:id', signedIn, async (c) => {
    const body = (await c.req.json().catch(() => undefined)) as { id?: unknown } | undefined;
    if (body?.id !== c.req.param('id')) return c.json({ error: "The organization's id doesn't match the URL" }, 400);
    // Not the hostname this page is on (only site admins change hostnames): the site would be gone,
    // and the page with it.
    const host = hostnameOf(c.req.header('host'));
    const hostnames = (body as { hostnames?: unknown }).hostnames;
    if (body?.id === c.get('site').id && orgs.isSiteAdmin(c.get('session').email) && Array.isArray(hostnames) && !hostnames.some((h) => typeof h === 'string' && h.trim().toLowerCase() === host))
      return c.json({ error: `You're on ${host}: keep it, or make the change from another of the organization's sites` }, 400);
    const result = await orgs.save(body, c.get('session').email);
    return result.ok ? c.json({ organization: result.saved }) : c.json({ error: result.error }, result.status);
  });
  app.delete('/api/admin/organizations/:id', signedIn, async (c) => {
    if (c.req.param('id') === c.get('site').id && orgs.isSiteAdmin(c.get('session').email)) return c.json({ error: "You can't delete the site you're on" }, 400);
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

  // Sign-in providers: site admins only, as member providers.
  app.get('/api/admin/sign-in-providers', signedIn, (c) => {
    if (!orgs.isSiteAdmin(c.get('session').email)) return c.json({ error: 'Only site admins can do that' }, 403);
    return c.json({ signInProviders: orgs.signInProviders(), usedBy: orgs.signInProviderUsers() } satisfies AdminSignInProvidersResponse);
  });
  app.put('/api/admin/sign-in-providers/:id', signedIn, async (c) => {
    const body = (await c.req.json().catch(() => undefined)) as { id?: unknown } | undefined;
    if (body?.id !== c.req.param('id')) return c.json({ error: "The sign-in provider's id doesn't match the URL" }, 400);
    const result = await orgs.saveSignInProvider(body, c.get('session').email);
    return result.ok ? c.json({ signInProvider: result.saved }) : c.json({ error: result.error }, result.status);
  });
  app.delete('/api/admin/sign-in-providers/:id', signedIn, async (c) => {
    const result = await orgs.removeSignInProvider(c.req.param('id')!, c.get('session').email);
    return result.ok ? c.json({ status: 'ok' }) : c.json({ error: result.error }, result.status);
  });

  const { debugActivity } = options;
  if (debugActivity) {
    app.get('/api/debug/activities/:id', async (c) => c.json(await debugActivity(c.req.param('id'), c.req.query('view') ?? 'manage')));
  }

  // Unknown API paths get a JSON 404 rather than the UI's index.html fallback.
  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

  return { app, injectWebSocket };
}
