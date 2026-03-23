import { BootDataResult } from '@app/shared';
import { Hono } from 'hono';

import { getUserFromSession } from '@server/lib/session';
import { AuthVariables } from '@server/middleware/auth';
import { EnvironmentService } from '@server/svc/environmentService';

export function setupEnvironmentApi(envService: EnvironmentService, googleClientId: string) {
  const apiRoutes = new Hono<{ Variables: AuthVariables }>();

  // In prod, we inject this into the HTML source so we can render branding/etc
  // correctly without blinking
  apiRoutes.get('/environment/dev', async (c) => {
    const bootData: BootDataResult = {
      result: {
        googleClientId,
        environment: await envService.getClientEnvironment(new URL(c.req.url).hostname),
      }
    };
    const sessionLogin = await getUserFromSession(c);
    if (sessionLogin) {
      const { id, ...clientParts } = sessionLogin;
      bootData.result.login = clientParts;
    }
    return c.json(bootData);
  });

  return apiRoutes;
}
