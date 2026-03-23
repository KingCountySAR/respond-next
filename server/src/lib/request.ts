import { Context } from 'hono';

export function domainFromRequest(c: Context) {
  return c.req.header()['x-forwarded-host']?.split(':')?.[0] ?? new URL(c.req.url).hostname;
}
