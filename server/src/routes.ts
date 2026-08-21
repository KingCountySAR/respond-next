import { Hono } from 'hono';

import { AuthError } from '@shared/apiErrors';
import type { ActivityType } from '@shared/types/activity';
import type { AuthResponse } from '@shared/types/authResponse';
import type { BootstrapResponse } from '@shared/types/bootstrap';
import type { MyOrganization } from '@shared/types/organization';

import { clearAuth, getAuthFromContext, saveAuthToContext, userFromAuth } from './auth';
import * as Mongo from './mongodb';
import { getServices } from './services';

export const api = new Hono();

// ---- Activities -----------------------------------------------------------

async function activitiesList(activityType: ActivityType) {
  const list = (await (await getServices()).stateManager.getAllActivities())
    .filter((a) => a.isMission === (activityType === 'missions'))
    .sort((a, b) => (a.startTime > b.startTime ? 1 : a.startTime < b.startTime ? -1 : 0));
  return { status: 'ok', data: list };
}

api.get('/v1/missions', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ status: 'not authenticated' }, 401);
  return c.json(await activitiesList('missions'));
});

api.get('/v1/events', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ status: 'not authenticated' }, 401);
  return c.json(await activitiesList('events'));
});

api.get('/v1/activities/:activityId', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ status: 'not authenticated' }, 401);
  const activity = (await (await getServices()).stateManager.getAllActivities()).find((a) => a.id === c.req.param('activityId'));
  if (!activity) return c.json({ status: 'not found' }, 404);
  return c.json({ status: 'ok', data: activity });
});

// ---- Organizations / members ---------------------------------------------

api.get('/v1/organizations', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const list = await (await getServices()).stateManager.getAllOrganizations();
    return c.json({ status: 'ok', data: list });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return c.json({ error: 'Failed to fetch organizations' }, 500);
  }
});

api.get('/v1/organizations/:orgId/members', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const organizationDoc = await Mongo.getOrganizationById(c.req.param('orgId'));
    if (!organizationDoc) return c.json({ error: 'Organization not found' }, 404);

    const memberProvider = (await getServices()).memberProviders.get(organizationDoc.memberProvider.provider);
    if (!memberProvider) {
      console.error(`Member provider not found for org ${organizationDoc.id}: ${organizationDoc.memberProvider?.provider}`);
      return c.json({ error: 'Member provider not configured' }, 500);
    }

    const query = c.req.query('query')?.trim() ?? '';
    if (query.length < 3 || query.length > 100) {
      return c.json({ error: 'Query must be between 3 and 100 characters' }, 400);
    }

    const list = await memberProvider.searchMembers(organizationDoc.id, query);
    if (!list) return c.json({ error: 'No results found' }, 404);
    return c.json({ data: list });
  } catch (error) {
    console.error('Error searching members:', error);
    return c.json({ error: 'Failed to search members' }, 500);
  }
});

api.get('/v1/organizations/:orgId/members/:memberId', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ status: 'not authenticated' }, 401);
  const organizationDoc = await Mongo.getOrganizationById(c.req.param('orgId'));
  if (!organizationDoc) return c.json({ status: 'unknown organization' }, 500);

  const memberProvider = (await getServices()).memberProviders.get(organizationDoc.memberProvider.provider);
  if (!memberProvider) return c.json({ status: 'unknown member provider' }, 500);

  const memberInfo = await memberProvider.getParticipantInfo(c.req.param('memberId'));
  if (!memberInfo) return c.json({ status: 'not found' }, 404);
  return c.json({ data: memberInfo, status: 200 });
});

api.get('/v1/organizations/:orgId/members/:memberId/photo', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ status: 'not authenticated' }, 401);
  const organizationDoc = await Mongo.getOrganizationById(c.req.param('orgId'));
  if (!organizationDoc) return c.json({ status: 'unknown organization' }, 500);

  const memberProvider = (await getServices()).memberProviders.get(organizationDoc.memberProvider.provider);
  if (!memberProvider) return c.json({ status: 'unknown member provider' }, 500);

  const photo = await memberProvider.getMemberPhoto(c.req.param('memberId'));
  if (!photo) return c.json({ status: 'not found' }, 404);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.body(photo as any);
});

// ---- SPA bootstrap (replaces Next server-component data fetch) ------------

api.get('/bootstrap', async (c) => {
  const domain = c.req.header('host')?.split(':')[0] ?? '';
  const org = await Mongo.getOrganizationForDomain(domain);
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
    brand: { faviconUrl: org?.brand.faviconUrl, homeScreenIconUrl: org?.brand.homeScreenIconUrl },
  } satisfies BootstrapResponse);
});

// ---- Auth: Google login / logout -----------------------------------------

api.post('/auth/google', async (c) => {
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
    const organizationDoc = await Mongo.getOrganizationForDomain(domain);
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

api.post('/auth/logout', async (c) => {
  await clearAuth(c);
  return c.json({ status: 'ok' });
});

// ---- Weather --------------------------------------------------------------

type NoaaPointResponse = {
  properties?: {
    forecastHourly?: string;
  };
};

type NoaaForecastResponse = {
  properties?: {
    periods?: Array<{
      temperature?: number;
      temperatureUnit?: string;
      relativeHumidity?: { value?: number | null };
      windSpeed?: string;
      shortForecast?: string;
      icon?: string;
      name?: string;
    }>;
  };
};

const NOAA_USER_AGENT = 'KCesar Respond weather dashboard (https://github.com/KingCountySAR/respond-next)';

api.get('/weather', async (c) => {
  const latitude = Number(c.req.query('lat'));
  const longitude = Number(c.req.query('lon'));

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return c.json({ error: 'Invalid coordinates.' }, 400);
  }

  try {
    const headers = { Accept: 'application/geo+json', 'User-Agent': NOAA_USER_AGENT };
    const pointsResponse = await fetch(`https://api.weather.gov/points/${latitude},${longitude}`, { headers });

    if (!pointsResponse.ok) {
      return c.json({ error: `NOAA points service error (${pointsResponse.status})` }, 502);
    }

    const points = (await pointsResponse.json()) as NoaaPointResponse;
    const forecastUrl = points.properties?.forecastHourly;
    if (!forecastUrl) {
      return c.json({ error: 'NOAA did not provide an hourly forecast.' }, 502);
    }

    const forecastResponse = await fetch(forecastUrl, { headers });
    if (!forecastResponse.ok) {
      return c.json({ error: `NOAA forecast service error (${forecastResponse.status})` }, 502);
    }

    const forecast = (await forecastResponse.json()) as NoaaForecastResponse;
    const period = forecast.properties?.periods?.[0];
    if (period?.temperature == null || !period.temperatureUnit || !period.shortForecast) {
      return c.json({ error: 'NOAA returned an incomplete forecast.' }, 502);
    }

    return c.json({
      forecastUrl: `https://forecast.weather.gov/MapClick.php?lat=${latitude}&lon=${longitude}`,
      period: {
        name: period.name ?? 'Current forecast',
        temperature: period.temperature,
        temperatureUnit: period.temperatureUnit,
        humidity: period.relativeHumidity?.value ?? null,
        windSpeed: period.windSpeed ?? 'Unavailable',
        shortForecast: period.shortForecast,
        icon: period.icon ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to load NOAA weather', error);
    return c.json({ error: 'Failed to load weather from NOAA.' }, 502);
  }
});
