import { Hono } from 'hono';
import { createNodeWebSocket } from '@hono/node-ws';
import { PROTOCOL } from '@sync/core';
import { TIERS, type ActivityViewer, type BootstrapResponse, type SiteConfig, type Tier } from '@sync/domain';
import type { Hub } from '@sync/server';

export interface SyncAppOptions {
  /** The site name and colours clients load first. */
  site: SiteConfig;
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

  const { debugActivity } = options;
  if (debugActivity) {
    app.get('/api/debug/activities/:id', async (c) => c.json(await debugActivity(c.req.param('id'), c.req.query('view') ?? 'command')));
  }

  // Unknown API paths get a JSON 404 rather than the UI's index.html fallback.
  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

  return { app, injectWebSocket };
}
