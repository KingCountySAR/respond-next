/**
 * The site's app icon at the sizes the app asks for (`/api/icon/<size>.png`, and
 * `/api/icon/maskable/<size>.png`): the smallest stored icon at least that big, or else the
 * largest, scaled down and padded to a square PNG. One that Jimp can't read (an SVG) is served as
 * stored, for the browser to scale.
 */
import { createHash } from 'node:crypto';
import { Jimp, JimpMime } from 'jimp';
import { ICON_SIZES, type BrandIcons, type IconSize } from '@sync/domain';

export interface RenderedIcon {
  body: Uint8Array<ArrayBuffer>;
  type: string;
  etag: string;
}

/** Which stored icon serves a size: plain, or maskable (falling back to plain when there are none). */
export function iconSourceFor(icons: BrandIcons, size: IconSize, maskable: boolean): string | undefined {
  const set: Partial<Record<IconSize, string>> = maskable && hasMaskable(icons) ? icons.maskable! : icons;
  const available = ICON_SIZES.filter((s) => set[s]);
  const best = available.find((s) => s >= size) ?? available.at(-1);
  return best && set[best];
}

export function hasMaskable(icons: BrandIcons): boolean {
  return ICON_SIZES.some((s) => icons.maskable?.[s]);
}

export function iconSizeOf(param: string): IconSize | undefined {
  const size = Number(/^(\d+)\.png$/.exec(param)?.[1]);
  return ICON_SIZES.find((s) => s === size);
}

/** The bytes of a `data:` URI, or undefined for anything else (an `https://` URL). */
function decodeDataUri(source: string): { type: string; bytes: Buffer } | undefined {
  const [, type, data] = /^data:([^;]+);base64,(.*)$/s.exec(source) ?? [];
  return type && data !== undefined ? { type, bytes: Buffer.from(data, 'base64') } : undefined;
}

const MAX_CACHED = 200;

export class IconRenderer {
  // Scaling is the costly part; icons change rarely, so keep what's been made.
  private readonly cache = new Map<string, Promise<RenderedIcon | undefined>>();

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  render(source: string, size: IconSize): Promise<RenderedIcon | undefined> {
    const key = `${size}:${createHash('sha256').update(source).digest('base64url')}`;
    let rendered = this.cache.get(key);
    if (!rendered) {
      if (this.cache.size >= MAX_CACHED) this.cache.clear();
      rendered = this.make(source, size, key);
      this.cache.set(key, rendered);
      // A failure (an unreachable URL) is tried again next time.
      void rendered.then((r) => r ?? this.cache.delete(key)).catch(() => this.cache.delete(key));
    }
    return rendered;
  }

  private async make(source: string, size: IconSize, etag: string): Promise<RenderedIcon | undefined> {
    let original = decodeDataUri(source);
    if (!original) {
      const res = await this.fetchImpl(source);
      if (!res.ok) return undefined;
      original = { type: res.headers.get('content-type') ?? 'application/octet-stream', bytes: Buffer.from(await res.arrayBuffer()) };
    }
    try {
      const image = await Jimp.read(original.bytes);
      const png = await image.contain({ w: size, h: size }).getBuffer(JimpMime.png);
      return { body: Uint8Array.from(png), type: 'image/png', etag: `"${etag}"` };
    } catch {
      return { body: Uint8Array.from(original.bytes), type: original.type, etag: `"${etag}"` };
    }
  }
}
