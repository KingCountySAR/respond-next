import { timingSafeEqual } from 'crypto';

/**
 * Authentication for external partner applications (e.g. Seattle Mountain
 * Rescue's "Project Pika") that integrate with Respond over HTTP rather than
 * through the interactive (cookie / Google OAuth) session used by the web UI.
 *
 * A partner authenticates with a static API key supplied in the `x-api-key`
 * request header. Each key is bound to a single owning organization id. All
 * partner requests are then scoped to that organization (and its configured
 * partners) so a partner can never read or write data outside its own org.
 *
 * Keys are configured via the `PARTNER_API_KEYS` environment variable, which
 * holds a JSON object mapping each API key to the organization id it grants
 * access to. Example:
 *
 *   PARTNER_API_KEYS={"<random-secret-key>":"3"}
 *
 * NOTE: For a production hardening pass these keys should be stored hashed
 * (e.g. SHA-256) rather than in plaintext env, but plaintext keeps the
 * prototype simple to configure and review.
 */
export interface PartnerContext {
  /** Organization id this API key is scoped to. */
  orgId: string;
  /** Short, non-secret identifier for the key, safe to log. */
  keyId: string;
}

function loadKeyMap(): Record<string, string> {
  const raw = process.env.PARTNER_API_KEYS;
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    console.error('PARTNER_API_KEYS must be a JSON object mapping key -> orgId');
    return {};
  } catch {
    console.error('PARTNER_API_KEYS is not valid JSON');
    return {};
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Validates the `x-api-key` header on an incoming request.
 * @returns the resolved PartnerContext, or null if the key is missing/invalid.
 */
export function authenticatePartner(request: Request): PartnerContext | null {
  const provided = request.headers.get('x-api-key');
  if (!provided) {
    return null;
  }
  const keyMap = loadKeyMap();
  for (const [key, orgId] of Object.entries(keyMap)) {
    if (safeEqual(provided, key)) {
      return { orgId, keyId: key.slice(0, 8) };
    }
  }
  return null;
}
