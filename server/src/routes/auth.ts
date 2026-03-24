import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';

import { domainFromRequest } from '@server/lib/request.js';
import { SessionLogin } from '@server/model/auth.js';
import { OrganizationService } from '@server/svc/organizationService.js';

import { deleteSession, getSession, updateSession } from '../lib/session.js';

interface GoogleUser {
  sub: string
  email?: string
  name?: string
  picture?: string
  aud?: string
  exp?: string
  hd?: string
}

export function setupAuthRoutes(orgService: OrganizationService) {
  const authRoutes = new Hono();

  // Verify a Google ID token and exchange it for a session cookie.
  // The token is obtained entirely client-side via Google Identity Services —
  // no redirect URI registration required, only Authorized JavaScript Origins.
  authRoutes.post('/google', async (c) => {
    const { credential } = await c.req.json<{ credential?: string }>();
    if (!credential) return c.json({ error: 'Missing credential' }, 400);

    // Verify the JWT with Google's tokeninfo endpoint.
    // For higher volume, verify locally using Google's public keys instead.
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!res.ok) return c.json({ error: 'Invalid token' }, 401);

    const payload = await res.json() as GoogleUser;

    // Ensure the token was issued for your client ID, not someone else's app
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      return c.json({ error: 'Token audience mismatch' }, 401);
    }

    // Ensure the token hasn't expired (tokeninfo does this too, but be explicit)
    if (!payload.exp || Date.now() / 1000 > Number(payload.exp)) {
      return c.json({ error: 'Token expired' }, 401);
    }

    if (!payload.email) return c.json({ error: 'No email in token' }, 401);

    let authn = false;
    const domain = domainFromRequest(c);
    const org = await orgService.getOrgForDomain(domain);
    if (!org) {
      return c.text('Invalid domain', 500);
    }


    const login: SessionLogin = {
      id: payload.sub,
      name: payload.name ?? 'Unknown',
      email: payload.email,
      picture: payload.picture,
    };

    for (const loginP of await org.loginProviders) {
      if (loginP.type === 'whitelist') {
        if (loginP.list.some((f) => f.toLowerCase() === payload.email?.toLowerCase())) {
          authn = true;
        }
        break;
      } else if (loginP.type === 'membership') {
        const memberProvider = await orgService.getMemberProviderForOrganization(org);
        const member = await memberProvider.getMemberInfoByEmail(payload.email);
        if (member) {
          authn = true;
          login.memberId = member.id;
        }
      }
    }

    if (!authn) {
      return c.text('Unauthorized', 403);
    }

    await updateSession(await getSession(c, true), { login });
    const { id, ...clientLogin } = login;
    return c.json({ ok: true, login: clientLogin });
  });

  authRoutes.post('/logout', async (c) => {
    const session = await getSession(c);
    if (session) {
      deleteSession(session.id);
      deleteCookie(c, 'session');
    }
    return c.json({ ok: true });
  });

  return authRoutes;
}
