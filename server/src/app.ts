import { Hono } from 'hono';
import { createNodeWebSocket } from '@hono/node-ws';
import { PROTOCOL } from '@sync/core';
import { MEMBER_QUERY_MAX, MEMBER_QUERY_MIN, TIERS, type ActivityViewer, type BootstrapResponse, type SiteConfig, type Tier } from '@sync/domain';
import type { Hub } from '@sync/server';
import type { MemberDirectory } from './members';

export interface SyncAppOptions {
  /** The site name and colours clients load first. */
  site: SiteConfig;
  /** Member search and photos, for adding someone else to an activity. */
  members?: MemberDirectory;
  /** Dev-only JSON view of an activity's server state. Leave unset in production. */
  debugActivity?(activityId: string, view: string): Promise<unknown>;
}

/**
 * Phase 1 dev auth: identity comes from the query string (`?user=&tier=&class=&person=`). Replaced
 * by the session cookie and the activity's grants in phase 2.
 */
export function devViewer(query: (name: string) => string | undefined): ActivityViewer {
  const tier = query('tier');
  return {
    userId: query('user') || 'dev',
    tier: TIERS.includes(tier as Tier) ? (tier as Tier) : 'command',
    class: query('class') === 'external' ? 'external' : 'member',
    personRef: query('person') || undefined,
  };
}

export function createSyncApp(hub: Hub, options: SyncAppOptions) {
  const app = new Hono();
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get('/health', (c) => c.json({ ok: true }));
  app.get('/api/bootstrap', (c) => c.json({ config: options.site } satisfies BootstrapResponse));

  app.get(
    '/api/sync',
    upgradeWebSocket((c) => {
      const offered = (c.req.header('sec-websocket-protocol') ?? '').split(',').map((p) => p.trim());
      const viewer = devViewer((name) => c.req.query(name));
      let handlers: ReturnType<Hub['connect']> | undefined;
      return {
        onOpen(_evt, ws) {
          if (!offered.includes(PROTOCOL)) {
            ws.close(4400, `expected subprotocol ${PROTOCOL}`);
            return;
          }
          handlers = hub.connect({
            viewer,
            send: (text) => {
              if (ws.readyState === 1) ws.send(text);
            },
            close: (code, reason) => ws.close(code, reason),
          });
        },
        onMessage(evt) {
          if (typeof evt.data === 'string') handlers?.message(evt.data);
        },
        onClose() {
          handlers?.close();
        },
      };
    }),
  );

  // The legacy member routes. Phase 1 has no session to check; phase 2 requires one.
  const { members } = options;
  if (members) {
    app.get('/api/v1/organizations/:orgId/members', async (c) => {
      const query = c.req.query('query')?.trim() ?? '';
      if (query.length < MEMBER_QUERY_MIN || query.length > MEMBER_QUERY_MAX) return c.json({ error: `Query must be between ${MEMBER_QUERY_MIN} and ${MEMBER_QUERY_MAX} characters` }, 400);
      const list = await members.search(c.req.param('orgId'), query);
      if (!list) return c.json({ error: 'Organization not found' }, 404);
      return c.json({ data: list });
    });
    app.get('/api/v1/organizations/:orgId/members/:memberId/photo', async (c) => {
      const photo = await members.photo(c.req.param('orgId'), c.req.param('memberId'));
      if (!photo) return c.json({ status: 'not found' }, 404);
      return c.body(new Uint8Array(photo).buffer as ArrayBuffer, 200, { 'content-type': 'image/jpeg' });
    });
  }

  const { debugActivity } = options;
  if (debugActivity) {
    app.get('/api/debug/activities/:id', async (c) => c.json(await debugActivity(c.req.param('id'), c.req.query('view') ?? 'command')));
  }

  // Unknown API paths get a JSON 404 rather than the UI's index.html fallback.
  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

  return { app, injectWebSocket };
}
