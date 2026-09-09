import { Hono } from 'hono';

import { AuthError } from '@shared/apiErrors';
import type { AuthResponse } from '@shared/types/authResponse';
import type { MyOrganization } from '@shared/types/organization';

import { clearAuth, saveAuthToContext, userFromAuth } from '../auth';
import { getOrganizationForDomain } from '../mongodb';
import { getServices } from '../services';

export const authRoutes = new Hono();

// ---- Auth: Google login / logout -----------------------------------------

authRoutes.post('/auth/google', async (c) => {
  try {
    let payload;
    if (process.env.DEV_NETWORK_DISABLED) {
      payload = JSON.parse(process.env.DEV_AUTH_USER ?? '{}');
    } else {
      const { token } = await c.req.json<{ token?: string }>();
      if (!token) return c.json({ error: AuthError.NO_TICKET } satisfies AuthResponse, 500);
      const authClient = (await getServices()).authClient;
      const ticket = await authClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_ID });
      payload = ticket.getPayload();
    }

    if (!payload) return c.json({ error: AuthError.NO_TICKET } satisfies AuthResponse, 500);
    if (!payload.email) return c.json({ error: AuthError.NO_EMAIL } satisfies AuthResponse, 500);

    const domain = c.req.header('host')?.split(':')[0] ?? '';
    const organizationDoc = await getOrganizationForDomain(domain);
    if (!organizationDoc) {
      console.log(`${payload.email} trying to login with unknown domain ${domain}`);
      return c.json({ error: AuthError.INVALID_DOMAIN } satisfies AuthResponse, 403);
    }

    const organization: MyOrganization = {
      ...organizationDoc,
      memberProvider: organizationDoc.memberProvider.provider,
    };

    const memberProvider = (await getServices()).memberProviders.get(organizationDoc.memberProvider.provider);
    if (!memberProvider) {
      console.log(`Can't find memberProvider for org ${organization.id}: ${organizationDoc.memberProvider?.provider}`);
      return c.json({ error: AuthError.INVALID_CONFIGURATION, organization } satisfies AuthResponse, 500);
    }

    const memberInfo = await memberProvider.getMemberInfo(organizationDoc.id, { provider: 'google', email: payload.email }, organizationDoc.memberProvider);
    if (!memberInfo) {
      return c.json({ error: AuthError.USER_NOT_KNOWN, organization } satisfies AuthResponse, 403);
    }

    const auth = {
      email: payload.email,
      userId: memberInfo.id,
      organizationId: organization.id,
      groups: memberInfo.groups,
      isSiteAdmin: false,
      ...payload,
    };
    await saveAuthToContext(c, auth);
    console.log(`Logging in user ${payload.email}`);

    const userInfo = userFromAuth(auth);
    memberProvider.refresh();
    return c.json({ userInfo, organization: userInfo ? organization : undefined } satisfies AuthResponse);
  } catch (error) {
    return c.json({ error: (error as Error).message } satisfies AuthResponse, 500);
  }
});

authRoutes.post('/auth/logout', async (c) => {
  await clearAuth(c);
  return c.json({ status: 'ok' });
});
