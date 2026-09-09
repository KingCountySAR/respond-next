import { Hono } from 'hono';

import { getAuthFromContext, userFromAuth } from '../auth';
import { getOrganizationById } from '../mongodb';
import { getServices } from '../services';

export const organizationsRoutes = new Hono();

organizationsRoutes.get('/v1/organizations', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const list = await (await getServices()).stateManager.getAllOrganizations();
    return c.json({ status: 'ok', data: list });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return c.json({ error: 'Failed to fetch organizations' }, 500);
  }
});

organizationsRoutes.get('/v1/organizations/:orgId/members', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const organizationDoc = await getOrganizationById(c.req.param('orgId'));
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

organizationsRoutes.get('/v1/organizations/:orgId/members/:memberId', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ status: 'not authenticated' }, 401);
  const organizationDoc = await getOrganizationById(c.req.param('orgId'));
  if (!organizationDoc) return c.json({ status: 'unknown organization' }, 500);

  const memberProvider = (await getServices()).memberProviders.get(organizationDoc.memberProvider.provider);
  if (!memberProvider) return c.json({ status: 'unknown member provider' }, 500);

  const memberInfo = await memberProvider.getParticipantInfo(c.req.param('memberId'));
  if (!memberInfo) return c.json({ status: 'not found' }, 404);
  return c.json({ data: memberInfo, status: 200 });
});

organizationsRoutes.get('/v1/organizations/:orgId/members/:memberId/photo', async (c) => {
  if (!userFromAuth(await getAuthFromContext(c))) return c.json({ status: 'not authenticated' }, 401);
  const organizationDoc = await getOrganizationById(c.req.param('orgId'));
  if (!organizationDoc) return c.json({ status: 'unknown organization' }, 500);

  const memberProvider = (await getServices()).memberProviders.get(organizationDoc.memberProvider.provider);
  if (!memberProvider) return c.json({ status: 'unknown member provider' }, 500);

  const photo = await memberProvider.getMemberPhoto(c.req.param('memberId'));
  if (!photo) return c.json({ status: 'not found' }, 404);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.body(photo as any);
});
