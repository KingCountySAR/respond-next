import { describe, expect, it } from 'vitest';
import { CedarDirectory } from '../src/cedar';

const CEDAR = 'https://cedar.test';
const TOKEN_URL = 'https://hydra.test/oauth2/token';

const bob = {
  d4hId: 1234,
  name: { full: 'Bob Adams', first: 'Bob', legalFirst: 'Robert', last: 'Adams' },
  emails: ['bob@example.org', 'bob@work.example'],
  phone: '206-555-1234',
  groups: [{ groupId: 21, title: 'CRT Field', bundle: 'CRT Specific', unit: 'CRT' }, { groupId: 22, title: 'CRT Medical' }, { groupId: 20, title: 'CRT', bundle: 'Units' }],
  units: [{ groupId: 20, title: 'CRT', bundle: 'Units' }],
};
const rowan = { d4hId: 5678, name: { full: 'Rowan Pike', first: 'Rowan', last: 'Pike' }, emails: [], groups: [], units: [{ groupId: 30, title: 'RMR' }] };

/** cedar and Hydra, answering from a table; records each request's path and token. */
function fakeCedar(options: { tokens?: string[]; expiresIn?: number } = {}) {
  const tokens = [...(options.tokens ?? ['t1'])];
  const requests: { path: string; auth: string | null }[] = [];
  let tokenRequests = 0;
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.href === TOKEN_URL) {
      tokenRequests++;
      const body = new URLSearchParams(String(init?.body));
      expect(body.get('grant_type')).toBe('client_credentials');
      expect(new Headers(init?.headers).get('authorization')).toBe(`Basic ${Buffer.from('sync:secret').toString('base64')}`);
      return Response.json({ access_token: tokens.shift() ?? 'tN', expires_in: options.expiresIn ?? 3600, scope: body.get('scope') });
    }
    const auth = new Headers(init?.headers).get('authorization');
    requests.push({ path: url.pathname + url.search, auth });
    if (auth === 'Bearer expired') return Response.json({ error: 'invalid_token' }, { status: 401 });
    if (url.pathname === '/api/d4h/v3/members') {
      expect(url.searchParams.get('status')).toBe('OPERATIONAL');
      return Response.json({ results: [{ id: 1234, ref: 'K-12' }, { id: 5678 }, { id: 999 }], page: 0, pageSize: 25, totalSize: 3 });
    }
    const member = /^\/api\/v1\/members\/([^/]+)$/.exec(url.pathname)?.[1];
    if (member) return member === '1234' || decodeURIComponent(member) === 'bob@example.org' ? Response.json(bob) : member === '5678' ? Response.json(rowan) : Response.json({ error: 'not_found', message: 'No such member' }, { status: 404 });
    if (url.pathname === '/api/d4h/v3/members/1234/image') return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
    if (url.pathname === '/api/d4h/v3/members/77/image') return Response.json({ error: 'bad_gateway', message: 'D4H is unreachable' }, { status: 502 });
    return Response.json({ error: 'not_found' }, { status: 404 });
  }) as typeof fetch;
  return { fetch: fetchImpl, requests, tokenRequests: () => tokenRequests };
}

const directory = (fake: ReturnType<typeof fakeCedar>) =>
  new CedarDirectory({ url: CEDAR, tokenUrl: TOKEN_URL, clientId: 'sync', clientSecret: 'secret', source: 'kcsara', fetch: fake.fetch });

describe('cedar directory', () => {
  it("searches through D4H, keeping the unit's members, with cedar's names", async () => {
    const fake = fakeCedar();
    const found = await directory(fake).search('adams', 'CRT');
    expect(found).toEqual([
      { id: '1234', personRef: 'kcsara:1234', label: 'Bob Adams (K-12)', name: 'Bob Adams', given_name: 'Bob', family_name: 'Adams', groups: ['CRT Field', 'CRT Medical', 'CRT'], email: 'bob@example.org', mobilephone: '206-555-1234' },
    ]);
    expect(fake.requests[0]).toEqual({ path: '/api/d4h/v3/members?search=adams&size=25&status=OPERATIONAL', auth: 'Bearer t1' });
    expect((await directory(fake).search('pike', 'RMR')).map((m) => m.name)).toEqual(['Rowan Pike']);
    expect(await directory(fake).search('adams', 'Other')).toEqual([]);
    // Without a unit, everyone cedar has.
    expect((await directory(fake).search('a')).map((m) => m.name)).toEqual(['Bob Adams', 'Rowan Pike']);
  });

  it('looks people up by person ref or email, with their units', async () => {
    const fake = fakeCedar();
    const cedar = directory(fake);
    expect(await cedar.lookup('kcsara:1234')).toMatchObject({ member: { personRef: 'kcsara:1234', email: 'bob@example.org', groups: ['CRT Field', 'CRT Medical', 'CRT'] }, units: ['CRT'] });
    expect(await cedar.lookup('kcsara:999')).toBeUndefined();
    expect(await cedar.lookup('adhoc:abc')).toBeUndefined();
    expect(await cedar.lookup('kcsara:bob@example.org')).toBeUndefined(); // only D4H ids
    expect(await cedar.byEmail('Bob@Example.org')).toMatchObject({ member: { personRef: 'kcsara:1234' }, units: ['CRT'] });
    expect(await cedar.byEmail('nobody@example.org')).toBeUndefined();
    expect(await cedar.byEmail('../groups')).toBeUndefined();
    // Members are kept a while: asking again doesn't go back to cedar.
    const asked = fake.requests.length;
    await cedar.lookup('kcsara:1234');
    expect(fake.requests.length).toBe(asked);
  });

  it("passes photos through with their type, and is empty for one cedar doesn't have", async () => {
    const cedar = directory(fakeCedar());
    const photo = await cedar.photo('1234');
    expect([...photo!.data]).toEqual([1, 2, 3]);
    expect(photo!.contentType).toBe('image/png');
    expect(await cedar.photo('4321')).toBeUndefined();
    expect(await cedar.photo('../groups')).toBeUndefined();
    await expect(cedar.photo('77')).rejects.toThrow('cedar: D4H is unreachable');
  });

  it('keeps its token until near expiry, and gets a new one when cedar refuses it', async () => {
    const fake = fakeCedar({ tokens: ['expired', 't2'] });
    const cedar = directory(fake);
    expect(await cedar.lookup('kcsara:1234')).toBeDefined();
    expect(fake.requests.map((r) => r.auth)).toEqual(['Bearer expired', 'Bearer t2']);
    await cedar.search('adams', 'CRT');
    expect(fake.tokenRequests()).toBe(2);
  });
});
