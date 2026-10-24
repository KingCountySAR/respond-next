/**
 * The organizations, their member and sign-in providers, and the site admins. Every request looks up its site by
 * hostname, so they're held in memory; with Postgres, changes are written through and survive
 * restarts. A seed file is imported with `npm run seed` (seed.ts), not at startup. Providers' client
 * secrets are stored encrypted (see secrets.ts).
 */
import pg from 'pg';
import type { z } from 'zod';
import {
  MemberProviderConfig,
  Organization,
  OrganizationSeed,
  ORG_ADMIN_FIELDS,
  SignInProviderConfig,
  type Brand,
  type MemberProviderView,
  type SignInProviderView,
  type OrganizationPartner,
  type SiteConfig,
  type SiteUnit,
} from '@sync/domain';
import { SecretBox } from './secrets';

const DEFAULT_BRAND: Brand = { primary: 'rgb(200, 100, 100)' };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS organizations (
  id   text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS member_providers (
  id   text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS sign_in_providers (
  id   text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS site_admins (
  email text PRIMARY KEY
);
-- Kept the seed's history when the seed was applied at startup.
DROP TABLE IF EXISTS seeded;`;

/** `host` from a request: the hostname, lowercased, without the port. */
export const hostnameOf = (host: string | undefined): string => (host ?? '').replace(/:\d+$/, '').toLowerCase();

export type SaveResult<T = Organization> = { ok: true; saved: T } | { ok: false; status: 400 | 403 | 404; error: string };

export interface StoreOptions {
  /** Site admins from the environment (SITE_ADMINS), beside those stored. */
  envAdmins?: string[];
  /** Encrypts providers' secrets. In memory, a key for the process is made if none is given. */
  secrets?: SecretBox;
}

const UPSERT_ORGANIZATION = 'INSERT INTO organizations (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data';

const ONLY_SITE_ADMINS = { ok: false, status: 403, error: 'Only site admins can do that' } as const;

type AnyProvider = { id: string; kind: string; clientSecret?: string };

/**
 * One kind of provider (member or sign-in), as stored: client secrets encrypted, never sent back.
 * Saved without a secret, a provider keeps the one it had.
 */
class ProviderSet<T extends AnyProvider> {
  readonly stored = new Map<string, T>();

  constructor(
    readonly table: string,
    /** For messages: "member provider". */
    readonly what: string,
    readonly schema: z.ZodType<T, z.ZodTypeDef, unknown>,
    /** Whether a provider of this kind has a client secret. */
    private readonly hasSecret: (p: T) => boolean,
    private readonly secrets: SecretBox,
  ) {}

  get upsert(): string {
    return `INSERT INTO ${this.table} (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
  }

  views(): (Omit<T, 'clientSecret'> & { hasClientSecret?: boolean })[] {
    return [...this.stored.values()].sort((a, b) => a.id.localeCompare(b.id)).map((p) => (this.hasSecret(p) ? { ...withoutSecret(p), hasClientSecret: !!p.clientSecret } : p));
  }

  /** With its secret decrypted. `version` is the same object until the provider is changed. */
  config(id: string): { config: T; version: object } | undefined {
    const stored = this.stored.get(id);
    if (!stored) return undefined;
    return { config: stored.clientSecret ? { ...stored, clientSecret: this.secrets.decrypt(stored.clientSecret) } : stored, version: stored };
  }

  seal(p: T): T {
    return this.hasSecret(p) && p.clientSecret ? { ...p, clientSecret: this.secrets.encrypt(p.clientSecret) } : p;
  }

  /** What to store in place of the provider with its id: without a secret, it keeps the stored one. */
  toStore(p: T): T {
    const existing = this.stored.get(p.id);
    return this.hasSecret(p) && !p.clientSecret && existing?.kind === p.kind ? { ...p, clientSecret: existing.clientSecret } : this.seal(p);
  }
}

export class OrganizationStore {
  private readonly orgs = new Map<string, Organization>();
  private readonly providers: ProviderSet<MemberProviderConfig>;
  private readonly signIns: ProviderSet<SignInProviderConfig>;
  private storedAdmins = new Set<string>();
  private readonly envAdmins: Set<string>;

  private constructor(
    private readonly pool: pg.Pool | undefined,
    private readonly secrets: SecretBox,
    envAdmins: string[],
  ) {
    this.envAdmins = new Set(envAdmins.map((e) => e.trim().toLowerCase()).filter(Boolean));
    this.providers = new ProviderSet('member_providers', 'member provider', MemberProviderConfig, (p) => p.kind === 'cedar', secrets);
    this.signIns = new ProviderSet('sign_in_providers', 'sign-in provider', SignInProviderConfig, () => true, secrets);
  }

  /** In memory (tests, or no DATABASE_URL), starting from the seed. */
  static memory(seed: OrganizationSeed = OrganizationSeed.parse({}), options: StoreOptions = {}): OrganizationStore {
    const store = new OrganizationStore(undefined, options.secrets?.ready ? options.secrets : SecretBox.ephemeral(), options.envAdmins ?? []);
    for (const p of seed.memberProviders) store.providers.stored.set(p.id, store.providers.seal(p));
    for (const p of seed.signInProviders) store.signIns.stored.set(p.id, store.signIns.seal(p));
    for (const o of seed.organizations) store.orgs.set(o.id, o);
    store.storedAdmins = new Set(seed.siteAdmins);
    store.check();
    return store;
  }

  static async connect(url: string, options: StoreOptions = {}): Promise<OrganizationStore> {
    const pool = new pg.Pool({ connectionString: url });
    await pool.query(SCHEMA);
    const store = new OrganizationStore(pool, options.secrets ?? new SecretBox(undefined), options.envAdmins ?? []);
    const load = async <T extends AnyProvider>(set: ProviderSet<T>) => {
      for (const { data } of (await pool.query<{ data: unknown }>(`SELECT data FROM ${set.table}`)).rows) {
        const provider = set.schema.parse(data);
        set.stored.set(provider.id, provider);
      }
    };
    await load(store.providers);
    await load(store.signIns);
    for (const { data } of (await pool.query<{ data: unknown }>('SELECT data FROM organizations')).rows) {
      // Stored rows from before a field was added get its default.
      const org = Organization.parse(data);
      store.orgs.set(org.id, org);
    }
    store.storedAdmins = new Set((await pool.query<{ email: string }>('SELECT email FROM site_admins')).rows.map((r) => r.email));
    store.check();
    return store;
  }

  close(): Promise<void> {
    return this.pool?.end() ?? Promise.resolve();
  }

  /**
   * Adds a seed's providers, organizations and site admins. Each provider and organization replaces
   * any stored one with its id, except that a provider without a secret keeps the stored secret; nothing else is changed or removed. Throws, having written nothing, unless the
   * result hangs together.
   */
  async importSeed(seed: OrganizationSeed): Promise<void> {
    const providers = new Map(this.providers.stored);
    for (const p of seed.memberProviders) providers.set(p.id, this.providers.toStore(p));
    const signIns = new Map(this.signIns.stored);
    for (const p of seed.signInProviders) signIns.set(p.id, this.signIns.toStore(p));
    const orgs = new Map(this.orgs);
    for (const o of seed.organizations) orgs.set(o.id, o);
    const problem = problems(orgs, providers, signIns)[0];
    if (problem) throw new Error(`organizations: ${problem}`);
    await this.transaction(async (client) => {
      for (const p of seed.memberProviders) await client.query(this.providers.upsert, [p.id, providers.get(p.id)]);
      for (const p of seed.signInProviders) await client.query(this.signIns.upsert, [p.id, signIns.get(p.id)]);
      for (const o of seed.organizations) await client.query(UPSERT_ORGANIZATION, [o.id, o]);
      for (const e of seed.siteAdmins) await client.query('INSERT INTO site_admins (email) VALUES ($1) ON CONFLICT DO NOTHING', [e]);
    });
    for (const [id, p] of providers) this.providers.stored.set(id, p);
    for (const [id, p] of signIns) this.signIns.stored.set(id, p);
    for (const [id, o] of orgs) this.orgs.set(id, o);
    for (const e of seed.siteAdmins) this.storedAdmins.add(e);
  }

  get(id: string): Organization | undefined {
    return this.orgs.get(id);
  }

  all(): Organization[] {
    return [...this.orgs.values()].sort((a, b) => a.title.localeCompare(b.title));
  }

  /** The member providers, without their secrets. */
  memberProviders(): MemberProviderView[] {
    return this.providers.views() as MemberProviderView[];
  }

  /**
   * A member provider with its secret decrypted, for building its directory. `version` is the same
   * object until the provider is changed, so callers can keep what they build from it.
   */
  memberProvider(id: string): { config: MemberProviderConfig; version: object } | undefined {
    return this.providers.config(id);
  }

  /** The organizations that name each member provider as theirs. */
  providerUsers(): Record<string, string[]> {
    return this.usersOf(this.providers, 'memberProvider');
  }

  /** Site admins only. A cedar provider saved without a secret keeps the one it had. */
  saveProvider(input: unknown, email: string | undefined): Promise<SaveResult<MemberProviderView>> {
    return this.saveIn(this.providers, input, email) as Promise<SaveResult<MemberProviderView>>;
  }

  /** Site admins only; not while an organization uses it. */
  removeProvider(id: string, email: string | undefined): Promise<SaveResult<null>> {
    return this.removeFrom(this.providers, 'memberProvider', id, email);
  }

  /** The sign-in providers, without their secrets. */
  signInProviders(): SignInProviderView[] {
    return this.signIns.views() as SignInProviderView[];
  }

  /** A sign-in provider with its secret decrypted; `version` as for `memberProvider`. */
  signInProvider(id: string): { config: SignInProviderConfig; version: object } | undefined {
    return this.signIns.config(id);
  }

  /** The organizations that name each sign-in provider as theirs. */
  signInProviderUsers(): Record<string, string[]> {
    return this.usersOf(this.signIns, 'signInProvider');
  }

  /** Site admins only. Saved without a secret, it keeps the one it had. */
  saveSignInProvider(input: unknown, email: string | undefined): Promise<SaveResult<SignInProviderView>> {
    return this.saveIn(this.signIns, input, email) as Promise<SaveResult<SignInProviderView>>;
  }

  /** Site admins only; not while an organization uses it. */
  removeSignInProvider(id: string, email: string | undefined): Promise<SaveResult<null>> {
    return this.removeFrom(this.signIns, 'signInProvider', id, email);
  }

  private usersOf<T extends AnyProvider>(set: ProviderSet<T>, field: 'memberProvider' | 'signInProvider'): Record<string, string[]> {
    const used: Record<string, string[]> = Object.fromEntries([...set.stored.keys()].map((id) => [id, []]));
    for (const o of this.all()) {
      const id = o[field];
      if (id) (used[id] ??= []).push(o.id);
    }
    return used;
  }

  private async saveIn<T extends AnyProvider>(set: ProviderSet<T>, input: unknown, email: string | undefined): Promise<SaveResult<unknown>> {
    if (!this.isSiteAdmin(email)) return ONLY_SITE_ADMINS;
    const parsed = set.schema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error, set.what);
    let stored: T;
    try {
      stored = set.toStore(parsed.data);
    } catch (err) {
      return { ok: false, status: 400, error: (err as Error).message };
    }
    await this.pool?.query(set.upsert, [stored.id, stored]);
    set.stored.set(stored.id, stored);
    return { ok: true, saved: set.views().find((p) => p.id === stored.id)! };
  }

  private async removeFrom<T extends AnyProvider>(set: ProviderSet<T>, field: 'memberProvider' | 'signInProvider', id: string, email: string | undefined): Promise<SaveResult<null>> {
    if (!this.isSiteAdmin(email)) return ONLY_SITE_ADMINS;
    if (!set.stored.has(id)) return { ok: false, status: 404, error: `No such ${set.what}` };
    const users = this.usersOf(set, field)[id] ?? [];
    if (users.length) return { ok: false, status: 400, error: `${id} is in use by ${users.join(', ')}` };
    await this.pool?.query(`DELETE FROM ${set.table} WHERE id = $1`, [id]);
    set.stored.delete(id);
    return { ok: true, saved: null };
  }

  /** Runs `work` in a transaction; in memory, does nothing. */
  private async transaction(work: (client: pg.PoolClient) => Promise<void>): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await work(client);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** The site an incoming request is for, by its Host header. */
  forHost(host: string | undefined): Organization | undefined {
    const name = hostnameOf(host);
    return this.all().find((o) => o.hostnames.includes(name));
  }

  /** The organization whose people use this email's domain. */
  forEmail(email: string): Organization | undefined {
    const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
    return this.all().find((o) => o.emailDomains.includes(domain));
  }

  /** The organization, then its parent, and so on up. */
  lineage(id: string): Organization[] {
    const line: Organization[] = [];
    for (let org = this.orgs.get(id); org && !line.includes(org); org = org.parentId ? this.orgs.get(org.parentId) : undefined) line.push(org);
    return line;
  }

  /** The member provider an organization uses: its own, or its nearest ancestor's. */
  providerOf(id: string): string | undefined {
    return this.lineage(id).find((o) => o.memberProvider)?.memberProvider ?? undefined;
  }

  /** The sign-in provider an organization's site uses: its own, or its nearest ancestor's. */
  signInProviderOf(id: string): string | undefined {
    return this.lineage(id).find((o) => o.signInProvider)?.signInProvider ?? undefined;
  }

  /**
   * An organization's partners: its own, then its ancestors', nearest first. Its own entry for a
   * partner (or the nearer ancestor's) decides what it may create for that partner.
   */
  partnersOf(id: string): OrganizationPartner[] {
    const found = new Map<string, OrganizationPartner>();
    for (const o of this.lineage(id)) for (const p of o.partners) if (p.id !== id && !found.has(p.id)) found.set(p.id, p);
    return [...found.values()];
  }

  brandOf(id: string): Brand {
    return this.lineage(id).find((o) => o.brand)?.brand ?? DEFAULT_BRAND;
  }

  /** What `/api/bootstrap` gives a site's clients. */
  siteConfig(org: Organization, options: { devSignIn: boolean; googleSignIn?: boolean; buildId: string }): SiteConfig {
    const unit = (o: Organization, can: { canCreateMissions: boolean; canCreateEvents: boolean }): SiteUnit => ({
      id: o.id,
      title: o.title,
      shortTitle: o.shortTitle,
      canCreateMissions: can.canCreateMissions,
      canCreateEvents: can.canCreateEvents,
    });
    const partners = this.partnersOf(org.id).flatMap((p) => {
      const partner = this.orgs.get(p.id);
      return partner ? [unit(partner, p)] : [];
    });
    const brand = this.brandOf(org.id);
    return {
      organization: { ...unit(org, org), partners },
      theme: { primary: brand.primary, primaryDark: brand.primaryDark },
      devSignIn: options.devSignIn,
      googleSignIn: options.googleSignIn ?? false,
      buildId: options.buildId,
    };
  }

  isSiteAdmin(email: string | undefined): boolean {
    const e = email?.toLowerCase();
    return !!e && (this.envAdmins.has(e) || this.storedAdmins.has(e));
  }

  /** Site admins may edit every organization; an organization's admins, it and those under it. */
  canEdit(email: string | undefined, id: string): boolean {
    const e = email?.toLowerCase();
    return !!e && (this.isSiteAdmin(e) || this.lineage(id).some((o) => o.admins.includes(e)));
  }

  editableBy(email: string | undefined): Organization[] {
    return this.all().filter((o) => this.canEdit(email, o.id));
  }

  isAdmin(email: string | undefined): boolean {
    return this.editableBy(email).length > 0;
  }

  siteAdmins(): { fromEnvironment: string[]; stored: string[] } {
    return { fromEnvironment: [...this.envAdmins].sort(), stored: [...this.storedAdmins].sort() };
  }

  async setSiteAdmins(emails: string[]): Promise<void> {
    const next = new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean));
    await this.transaction(async (client) => {
      await client.query('DELETE FROM site_admins');
      for (const e of next) await client.query('INSERT INTO site_admins (email) VALUES ($1)', [e]);
    });
    this.storedAdmins = next;
  }

  /**
   * Adds or changes an organization for `email`. Site admins may change anything. An organization's
   * admins may change its settings (ORG_ADMIN_FIELDS), but not create organizations or move them.
   */
  async save(input: unknown, email: string | undefined): Promise<SaveResult> {
    const parsed = Organization.safeParse(input);
    if (!parsed.success) return invalid(parsed.error, 'organization');
    let org = parsed.data;
    const existing = this.orgs.get(org.id);
    // The admin page doesn't edit it.
    if (org.legacyId === undefined && existing?.legacyId !== undefined) org = { ...org, legacyId: existing.legacyId };
    if (!this.isSiteAdmin(email)) {
      if (!existing || !this.canEdit(email, org.id)) return ONLY_SITE_ADMINS;
      org = { ...existing, ...Object.fromEntries(ORG_ADMIN_FIELDS.map((f) => [f, org[f]])) };
    }
    const next = new Map(this.orgs).set(org.id, org);
    const problem = problems(next, this.providers.stored, this.signIns.stored)[0];
    if (problem) return { ok: false, status: 400, error: problem };
    await this.pool?.query(UPSERT_ORGANIZATION, [org.id, org]);
    this.orgs.set(org.id, org);
    return { ok: true, saved: org };
  }

  /** Site admins only; not while another organization is under it or partners with it. */
  async remove(id: string, email: string | undefined): Promise<SaveResult<null>> {
    if (!this.isSiteAdmin(email)) return ONLY_SITE_ADMINS;
    if (!this.orgs.has(id)) return { ok: false, status: 404, error: 'No such organization' };
    const next = new Map(this.orgs);
    next.delete(id);
    const problem = problems(next, this.providers.stored, this.signIns.stored)[0];
    if (problem) return { ok: false, status: 400, error: problem };
    await this.pool?.query('DELETE FROM organizations WHERE id = $1', [id]);
    this.orgs.delete(id);
    return { ok: true, saved: null };
  }

  /** Startup: what was loaded must hang together. */
  private check(): void {
    const problem = problems(this.orgs, this.providers.stored, this.signIns.stored)[0];
    if (problem) throw new Error(`organizations: ${problem}`);
  }
}

function withoutSecret<T extends { clientSecret?: string }>(p: T): Omit<T, 'clientSecret'> {
  const { clientSecret: _, ...rest } = p;
  return rest;
}

function invalid(error: { issues: { path: PropertyKey[]; message: string }[] }, what: string): { ok: false; status: 400; error: string } {
  const issue = error.issues[0];
  return { ok: false, status: 400, error: issue ? `${issue.path.join('.') || what}: ${issue.message}` : `Invalid ${what}` };
}

/** What's wrong with a set of organizations as a whole: unknown references, cycles, shared hostnames. */
export function problems(orgs: Map<string, Organization>, providers: ReadonlyMap<string, unknown>, signIns: ReadonlyMap<string, unknown> = new Map()): string[] {
  const found: string[] = [];
  const claimed = (what: string, pick: (o: Organization) => string[]) => {
    const owner = new Map<string, string>();
    for (const o of orgs.values()) {
      for (const name of pick(o)) {
        const other = owner.get(name);
        if (other && other !== o.id) found.push(`${what} ${name} belongs to both ${other} and ${o.id}`);
        owner.set(name, o.id);
      }
    }
  };
  claimed('hostname', (o) => o.hostnames);
  claimed('email domain', (o) => o.emailDomains);
  for (const o of orgs.values()) {
    if (o.parentId && !orgs.has(o.parentId)) found.push(`${o.id}'s parent ${o.parentId} doesn't exist`);
    if (o.memberProvider && !providers.has(o.memberProvider)) found.push(`${o.id}'s member provider ${o.memberProvider} doesn't exist`);
    if (o.signInProvider && !signIns.has(o.signInProvider)) found.push(`${o.id}'s sign-in provider ${o.signInProvider} doesn't exist`);
    for (const p of o.partners) {
      if (p.id === o.id) found.push(`${o.id} can't partner with itself`);
      else if (!orgs.has(p.id)) found.push(`${o.id}'s partner ${p.id} doesn't exist`);
    }
    const seen = new Set<string>();
    for (let at: Organization | undefined = o; at?.parentId; at = orgs.get(at.parentId)) {
      if (seen.has(at.id)) {
        found.push(`${o.id} is its own ancestor`);
        break;
      }
      seen.add(at.id);
    }
  }
  return found;
}
