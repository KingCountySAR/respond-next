import { BootData, BootDataResult } from '@app/shared';
import { AuthVariables } from '@server/middleware/auth.js';
import { Context, Hono } from 'hono';


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
