import { Hono } from 'hono';

import type { BootstrapResponse } from '@shared/types/bootstrap';
import type { MyOrganization } from '@shared/types/organization';

import { getAuthFromContext, userFromAuth } from '../auth';
import { getOrganizationForDomain } from '../mongodb';

export const bootstrapRoutes = new Hono();

// ---- SPA bootstrap (replaces Next server-component data fetch) ------------

bootstrapRoutes.get('/bootstrap', async (c) => {
  const domain = c.req.header('host')?.split(':')[0] ?? '';
  const org = await getOrganizationForDomain(domain);
  const user = userFromAuth(await getAuthFromContext(c));

  const config = {
    dev: {
      noExternalNetwork: !!process.env.DEV_NETWORK_DISABLED,
      buildId: process.env.CONFIG_BUILD_ID ?? 'unknown',
    },
    organization: {
      title: org?.title ?? 'Team',
      shortTitle: org?.rosterName ?? org?.title ?? 'Team',
    },
    theme: {
      primary: org?.brand.primary ?? 'rgb(200, 100, 100)',
      primaryDark: org?.brand.primaryDark,
    },
  };

  const myOrg: MyOrganization | undefined =
    user && org
      ? {
          id: org.id,
          rosterName: org.rosterName,
          title: org.title,
          canCreateMissions: org.canCreateMissions,
          canCreateEvents: org.canCreateEvents,
          memberProvider: org.memberProvider.provider,
          supportEmail: org.supportEmail,
          partners: org.partners?.map((p) => ({ id: p.id, title: p.title, rosterName: p.rosterName, canCreateMissions: p.canCreateMissions, canCreateEvents: p.canCreateEvents })) ?? [],
        }
      : undefined;

  return c.json({
    googleClient: process.env.GOOGLE_ID ?? '',
    config,
    user,
    myOrg,
  } satisfies BootstrapResponse);
});
