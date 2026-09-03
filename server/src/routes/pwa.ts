import type { Context } from 'hono';
import { Hono } from 'hono';
import { Jimp, JimpMime } from 'jimp';

import type { OrganizationBrandIcons } from '@shared/types/data/organizationDoc';

import { DEFAULT_BRAND_ICON } from '../defaultBrandIcon';
import * as Mongo from '../mongodb';

export const pwaRoutes = new Hono();

// ---- PWA manifest + icon (per-domain, resolved from the host header) ------

// Sizes the app actually references (favicon, apple-touch-icon, manifest icons).
// Kept as an allowlist so the resize route can't be used to force arbitrary sharp workloads.
const ICON_SIZES = [32, 180, 192, 512] as const;

// Avoids stale-icon confusion while iterating on brand.icon locally.
const ICON_CACHE_CONTROL = process.env.NODE_ENV === 'development' ? 'no-cache' : 'public, max-age=86400';

type IconSize = (typeof ICON_SIZES)[number];

function hasMaskableIcon(icons: OrganizationBrandIcons): boolean {
  return !!icons.maskable && Object.values(icons.maskable).some((src) => !!src);
}

pwaRoutes.get('/manifest.webmanifest', async (c) => {
  const domain = c.req.header('host')?.split(':')[0] ?? '';
  const org = await Mongo.getOrganizationForDomain(domain);
  const icons = org?.brand.icon ?? DEFAULT_BRAND_ICON;

  const manifest = {
    name: `Respond (${org?.title})`,
    short_name: `Respond (${org?.rosterName ?? org?.title})`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: org?.brand.primary ?? 'rgb(200, 100, 100)',
    icons: [
      { src: '/api/icon/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/icon/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Only advertised once a real maskable asset exists — declaring purpose "maskable"
      // against a non-safe-zoned image risks OS adaptive-icon shapes cropping it.
      ...(hasMaskableIcon(icons)
        ? [
            { src: '/api/icon/maskable/192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
            { src: '/api/icon/maskable/512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ]
        : []),
    ],
  };
  return c.body(JSON.stringify(manifest), 200, { 'Content-Type': 'application/manifest+json', 'Cache-Control': ICON_CACHE_CONTROL });
});

// Picks the smallest available icon that's >= the requested size (so we only ever scale
// down, never up), falling back to the largest available icon (512 is always present,
// directly or via the maskable-falls-back-to-plain lookup below).
function pickBestSize(size: number, lookup: (s: IconSize) => string | undefined): string {
  const bySize = ICON_SIZES.map((s) => [s, lookup(s)] as const)
    .filter((entry): entry is [IconSize, string] => !!entry[1])
    .sort(([a], [b]) => a - b);
  return (bySize.find(([s]) => s >= size) ?? bySize[bySize.length - 1])[1];
}

async function renderIcon(c: Context, size: IconSize | false, icon: string | undefined) {
  if (!size || !icon) return c.notFound();

  // brand.icon entries are either a data: URI (stored in Mongo) or an https:// URL
  // (hosted externally) — Jimp.read() accepts a Buffer for the former and a URL string for the latter.
  let source: Buffer | string;
  if (/^https:\/\//i.test(icon)) {
    source = icon;
  } else {
    const match = icon.match(/^data:image\/[a-z0-9.+-]+;base64,(.+)$/i);
    if (!match) return c.notFound();
    source = Buffer.from(match[1], 'base64');
  }

  const image = await Jimp.read(source);
  const png = await image.contain({ w: size, h: size }).getBuffer(JimpMime.png);
  return c.body(new Uint8Array(png), 200, { 'Content-Type': 'image/png', 'Cache-Control': ICON_CACHE_CONTROL });
}

pwaRoutes.get('/icon/:sizePng', async (c) => {
  const requested = c.req.param('sizePng').match(/^(\d+)\.png$/);
  const size = requested && ICON_SIZES.find((s) => s === Number(requested[1]));
  if (!size) return c.notFound();

  const domain = c.req.header('host')?.split(':')[0] ?? '';
  const org = await Mongo.getOrganizationForDomain(domain);
  const icons = org?.brand.icon ?? DEFAULT_BRAND_ICON;

  return renderIcon(
    c,
    size,
    pickBestSize(size, (s) => icons[s]),
  );
});

pwaRoutes.get('/icon/maskable/:sizePng', async (c) => {
  const requested = c.req.param('sizePng').match(/^(\d+)\.png$/);
  const size = requested && ICON_SIZES.find((s) => s === Number(requested[1]));
  if (!size) return c.notFound();

  const domain = c.req.header('host')?.split(':')[0] ?? '';
  const org = await Mongo.getOrganizationForDomain(domain);
  const icons = org?.brand.icon ?? DEFAULT_BRAND_ICON;

  return renderIcon(
    c,
    size,
    pickBestSize(size, (s) => icons.maskable?.[s] ?? icons[s]),
  );
});
