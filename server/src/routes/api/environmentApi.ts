import { BootData, BootDataResult } from '@app/shared';
import { Context, Hono } from 'hono';

import { AuthVariables } from '@server/middleware/auth.js';

export function setupEnvironmentApi(getData: (c: Context) => Promise<BootData>) {
  const apiRoutes = new Hono<{ Variables: AuthVariables }>();

  // In prod, we inject this into the HTML source so we can render branding/etc
  // correctly without blinking
  apiRoutes.get('/environment/dev', async (c) => {
    const result: BootDataResult = {
      result: await getData(c)
    };
    return c.json(result);
  });

  return apiRoutes;
}
