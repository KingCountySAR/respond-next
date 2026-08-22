import { authenticatePartner } from '@respond/lib/server/partnerAuth';

// authenticatePartner only reads `request.headers.get('x-api-key')`, so a
// minimal stub avoids depending on the web `Request`/`Headers` globals which
// are not present in the jsdom test environment.
function reqWithKey(key?: string): Request {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'x-api-key' ? key ?? null : null),
    },
  } as unknown as Request;
}

describe('authenticatePartner', () => {
  const ORIGINAL = process.env.PARTNER_API_KEYS;

  afterEach(() => {
    process.env.PARTNER_API_KEYS = ORIGINAL;
  });

  it('returns null when no key header is present', () => {
    process.env.PARTNER_API_KEYS = JSON.stringify({ 'secret-key': '3' });
    expect(authenticatePartner(reqWithKey())).toBeNull();
  });

  it('returns null when the key is not configured', () => {
    process.env.PARTNER_API_KEYS = JSON.stringify({ 'secret-key': '3' });
    expect(authenticatePartner(reqWithKey('wrong-key'))).toBeNull();
  });

  it('returns null when PARTNER_API_KEYS is unset', () => {
    delete process.env.PARTNER_API_KEYS;
    expect(authenticatePartner(reqWithKey('secret-key'))).toBeNull();
  });

  it('returns null when PARTNER_API_KEYS is malformed JSON', () => {
    process.env.PARTNER_API_KEYS = 'not-json';
    expect(authenticatePartner(reqWithKey('secret-key'))).toBeNull();
  });

  it('resolves the org id for a valid key', () => {
    process.env.PARTNER_API_KEYS = JSON.stringify({ 'smr-secret-key': '3' });
    const ctx = authenticatePartner(reqWithKey('smr-secret-key'));
    expect(ctx).not.toBeNull();
    expect(ctx?.orgId).toBe('3');
    expect(ctx?.keyId).toBe('smr-secr');
  });

  it('does not match on a key prefix (length-checked compare)', () => {
    process.env.PARTNER_API_KEYS = JSON.stringify({ 'smr-secret-key': '3' });
    expect(authenticatePartner(reqWithKey('smr-secret'))).toBeNull();
  });
});
