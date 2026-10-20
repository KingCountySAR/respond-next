/**
 * Sign-in with Google, through a site's sign-in provider (a Google OAuth client): the browser goes to
 * Google and comes back with a code, which the server swaps for an ID token. It names their email,
 * which the member directory knows.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { SignInProviderConfig } from '@sync/domain';
import type { OrganizationStore } from './organizations';

const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export interface GoogleOptions {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  now?: () => number;
}

/** What the browser keeps while it's away signing in (in a cookie), to finish with. */
export interface SignInStart {
  state: string;
  nonce: string;
  verifier: string;
}

const random = () => randomBytes(32).toString('base64url');

export class GoogleSignIn {
  private readonly fetch: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly options: GoogleOptions) {
    this.fetch = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  /** A new sign-in: where to send the browser, and what to keep for its return. */
  start(redirectUri: string): { url: string; keep: SignInStart } {
    const keep = { state: random(), nonce: random(), verifier: random() };
    const url = new URL(AUTHORIZE);
    for (const [k, v] of Object.entries({
      client_id: this.options.clientId,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: redirectUri,
      state: keep.state,
      nonce: keep.nonce,
      code_challenge: createHash('sha256').update(keep.verifier).digest('base64url'),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }))
      url.searchParams.set(k, v);
    return { url: url.toString(), keep };
  }

  /**
   * Swaps the code for an ID token: whose email it is, and their name. The token comes straight from
   * Google over HTTPS, so (as OpenID Connect allows) its signature isn't checked; its claims are.
   */
  async finish(code: string, redirectUri: string, kept: SignInStart): Promise<{ email: string; name?: string }> {
    const res = await this.fetch(TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: kept.verifier,
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
      }),
    });
    if (!res.ok) throw new Error(`Google refused the sign-in (HTTP ${res.status})`);
    const idToken = ((await res.json()) as { id_token?: string }).id_token;
    const claims = idToken?.split('.')[1];
    if (!claims) throw new Error('Google sent no ID token');
    const payload = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (!ISSUERS.includes(payload.iss as string) || payload.aud !== this.options.clientId) throw new Error("The ID token isn't for this app");
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < this.now()) throw new Error('The ID token has expired');
    if (payload.nonce !== kept.nonce) throw new Error('The ID token is for another sign-in');
    if (typeof payload.email !== 'string' || payload.email_verified !== true) throw new Error('The ID token names no verified email');
    return { email: payload.email.toLowerCase(), name: typeof payload.name === 'string' ? payload.name : undefined };
  }
}

/** Makes a client for a provider; tests pass one that doesn't reach Google. */
export type GoogleSignInFactory = (config: SignInProviderConfig & { clientSecret: string }) => GoogleSignIn;

/**
 * Each site's sign-in: its organization's sign-in provider, or its nearest ancestor's. One client per
 * provider, made again when the provider changes.
 */
export class SignInProviders {
  private readonly clients = new Map<string, { version: object; client: GoogleSignIn }>();

  constructor(
    private readonly orgs: OrganizationStore,
    private readonly make: GoogleSignInFactory = (config) => new GoogleSignIn(config),
  ) {}

  /** Undefined when the site has none, or it has no secret yet. */
  forSite(orgId: string): GoogleSignIn | undefined {
    const id = this.orgs.signInProviderOf(orgId);
    const provider = id ? this.orgs.signInProvider(id) : undefined;
    if (!id || !provider?.config.clientSecret) return undefined;
    const cached = this.clients.get(id);
    if (cached?.version === provider.version) return cached.client;
    const client = this.make({ ...provider.config, clientSecret: provider.config.clientSecret });
    this.clients.set(id, { version: provider.version, client });
    return client;
  }
}
