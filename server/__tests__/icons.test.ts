import { describe, expect, it } from 'vitest';
import { Jimp, JimpMime } from 'jimp';
import { OrganizationSeed, type BrandIcons } from '@sync/domain';
import { IconRenderer } from '../src/icons';
import { OrganizationStore } from '../src/organizations';
import { CRT_HOST, testApp, testSeed } from './helpers';

/** A PNG of one color, as a data URI. */
async function png(width: number, height: number, color: number): Promise<string> {
  const image = new Jimp({ width, height, color });
  return `data:image/png;base64,${(await image.getBuffer(JimpMime.png)).toString('base64')}`;
}

const RED = 0xff0000ff;
const BLUE = 0x0000ffff;
const GREEN = 0x00ff00ff;

/** CRT's site, with these icons on CRT's brand. */
function appWith(icon: BrandIcons, fetchImpl?: typeof fetch) {
  const seed = testSeed();
  const organizations = OrganizationStore.memory(
    OrganizationSeed.parse({ ...seed, organizations: seed.organizations.map((o) => (o.id === 'org-crt' ? { ...o, brand: { primary: '#336', icon } } : o)) }),
  );
  const { app } = testApp({ organizations, icons: new IconRenderer(fetchImpl) });
  return (path: string, headers: Record<string, string> = {}) => app.request(path, { headers: { host: CRT_HOST, ...headers } });
}

async function imageOf(res: Response) {
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toBe('image/png');
  const image = await Jimp.read(Buffer.from(await res.arrayBuffer()));
  return { width: image.width, height: image.height, center: image.getPixelColor(image.width / 2, image.height / 2), corner: image.getPixelColor(0, 0) };
}

describe('app icons', () => {
  it('are made at the size asked for, from the smallest stored one at least that big', async () => {
    const get = appWith({ 512: await png(512, 512, RED), 32: await png(32, 32, BLUE) });
    expect(await imageOf(await get('/api/icon/192.png'))).toMatchObject({ width: 192, height: 192, center: RED });
    expect(await imageOf(await get('/api/icon/32.png'))).toMatchObject({ width: 32, height: 32, center: BLUE });
    expect(await imageOf(await get('/api/icon/512.png'))).toMatchObject({ width: 512, center: RED });
    // Only the sizes the app uses.
    expect((await get('/api/icon/64.png')).status).toBe(404);
  });

  it('are padded to a square', async () => {
    const get = appWith({ 512: await png(600, 300, RED) });
    expect(await imageOf(await get('/api/icon/180.png'))).toMatchObject({ width: 180, height: 180, center: RED, corner: 0 });
  });

  it('offer maskable ones only when there are some, which otherwise fall back to the plain ones', async () => {
    const plain = appWith({ 512: await png(512, 512, RED) });
    const manifest = (await (await plain('/api/manifest.webmanifest')).json()) as { icons: { src: string; purpose: string }[] };
    expect(manifest.icons).toEqual([
      { src: '/api/icon/192.png', sizes: '192x192', purpose: 'any' },
      { src: '/api/icon/512.png', sizes: '512x512', purpose: 'any' },
    ]);
    expect(await imageOf(await plain('/api/icon/maskable/192.png'))).toMatchObject({ center: RED });

    const masked = appWith({ 512: await png(512, 512, RED), 192: await png(192, 192, BLUE), maskable: { 512: await png(512, 512, GREEN) } });
    const both = (await (await masked('/api/manifest.webmanifest')).json()) as { icons: { src: string; purpose: string }[] };
    expect(both.icons.map((i) => i.src)).toEqual(['/api/icon/192.png', '/api/icon/512.png', '/api/icon/maskable/192.png', '/api/icon/maskable/512.png']);
    // The maskable 192 is made from the maskable 512, not the plain 192.
    expect(await imageOf(await masked('/api/icon/maskable/192.png'))).toMatchObject({ width: 192, center: GREEN });
  });

  it('are served as stored when they can\'t be scaled (an SVG), and fetched from an https URL', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>';
    const get = appWith({ 512: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` });
    const res = await get('/api/icon/32.png');
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(await res.text()).toBe(svg);

    const remote = await png(64, 64, BLUE);
    const fetched: string[] = [];
    const fromUrl = appWith({ 512: 'https://icons.example.org/crt.png' }, async (input) => {
      fetched.push(String(input));
      return new Response(Buffer.from(remote.split(',')[1]!, 'base64'), { headers: { 'content-type': 'image/png' } });
    });
    expect(await imageOf(await fromUrl('/api/icon/32.png'))).toMatchObject({ width: 32, center: BLUE });
    await fromUrl('/api/icon/32.png');
    expect(fetched).toEqual(['https://icons.example.org/crt.png']);
  });

  it('answer a repeat request with Not Modified, and a site without icons with Not Found', async () => {
    const get = appWith({ 512: await png(512, 512, RED) });
    const first = await get('/api/icon/192.png');
    const etag = first.headers.get('etag')!;
    expect((await get('/api/icon/192.png', { 'if-none-match': etag })).status).toBe(304);

    const { app } = testApp();
    expect((await app.request('/api/icon/192.png', { headers: { host: 'rmr.localhost' } })).status).toBe(404);
  });
});
