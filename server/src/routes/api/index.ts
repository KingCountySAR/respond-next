import { zValidator } from '@hono/zod-validator';
import { getDb } from '@server/db/mongo.js';
import { domainFromRequest } from '@server/lib/request.js';
import { AuthVariables, withApiLogin } from '@server/middleware/auth.js';
import { OrganizationService } from '@server/svc/organizationService.js';
import { Hono } from 'hono';
import { z } from 'zod';


export function setupApiRoutes(orgService: OrganizationService) {
  const apiRoutes = new Hono<{ Variables: AuthVariables }>();

  apiRoutes.get('/members/search', withApiLogin, async (c) => {
    const q = c.req.query('q');
    let result: object[] = [];
    if (q && q.length >= 3) {
      const domain = domainFromRequest(c);
      const org = await orgService.getOrgForDomain(domain);
      const memberP = await orgService.getMemberProviderForOrganization(org);
      const members = await memberP.findMembers(q);
      result = members;
    }

    return c.json({ result, q });
  });

  apiRoutes.get('/members/:memberId/photo', withApiLogin, async (c) => {
    const { memberId } = c.req.param();
    const org = await orgService.getOrgForDomain(domainFromRequest(c));
    const memberP = await orgService.getMemberProviderForOrganization(org);
    const image = await memberP.getMemberPhoto(memberId);
    if (image) {
      c.header('Content-Type', 'image/jpeg');
      return c.body(image);
    }
    return c.text('not found', 404);
  });

  // Example CRUD route — replace with your actual domain models
  apiRoutes.get('/items', async (c) => {
    const db = getDb();
    const items = await db.collection('items').find().toArray();
    return c.json(items);
  });

  apiRoutes.post(
    '/items',
    zValidator(
      'json',
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      })
    ),
    async (c) => {
      const body = c.req.valid('json');
      const login = c.get('login');
      const db = getDb();

      const result = await db.collection('items').insertOne({
        ...body,
        createdBy: login.id,
        createdAt: new Date(),
      });

      return c.json({ id: result.insertedId }, 201);
    }
  );

  return apiRoutes;
}
