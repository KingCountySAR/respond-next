import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { randomId } from '@sync/core';
import { randomBytes } from 'node:crypto';
import { OrganizationStore } from '../src/organizations';
import { SecretBox } from '../src/secrets';
import { testSeed } from './helpers';

/** The Postgres cases run when TEST_DATABASE_URL (default: the `npm run db` container) is reachable. */
const POSTGRES_BASE = process.env.TEST_DATABASE_URL ?? 'postgres://sync:sync@localhost:5433/sync';

async function admin(sql: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: POSTGRES_BASE, connectionTimeoutMillis: 1500 });
  try {
    await client.connect();
  } catch {
    return false;
  }
  try {
    await client.query(sql);
    return true;
  } finally {
    await client.end();
  }
}

const SITE_ADMIN = 'admin@cvsc.example.org';
const hasPostgres = await admin('SELECT 1');

describe('organization store', () => {
  it('finds sites by hostname and people by email domain, and providers and brands up the tree', () => {
    const orgs = OrganizationStore.memory(testSeed());
    expect(orgs.forHost('CRT.localhost:4000')?.id).toBe('org-crt');
    expect(orgs.forHost('localhost')?.id).toBe('org-cvsc');
    expect(orgs.forHost('127.0.0.1')).toBeUndefined();
    expect(orgs.forEmail('Someone@RMR.example.org')?.id).toBe('org-rmr');
    expect(orgs.forEmail('someone@gmail.example')).toBeUndefined();
    expect(orgs.providerOf('org-rmr')).toBe('kcsara');
    expect(orgs.brandOf('org-rmr').primary).toBe('#933');
    expect(orgs.lineage('org-crt').map((o) => o.id)).toEqual(['org-crt', 'org-cvsc']);
  });

  it("refuses a seed that doesn't hang together", () => {
    const seed = testSeed();
    seed.organizations[1]!.parentId = 'org-missing';
    expect(() => OrganizationStore.memory(seed)).toThrow("organizations: org-crt's parent org-missing doesn't exist");
  });

  it("gives units their ancestors' partners, their own entries first", () => {
    const seed = testSeed();
    seed.organizations.push({ ...seed.organizations[2]!, id: 'org-sheriff', parentId: null, title: 'Sheriff', hostnames: [], emailDomains: [], partners: [] });
    seed.organizations[0]!.partners = [
      { id: 'org-sheriff', canCreateMissions: true, canCreateEvents: false },
      { id: 'org-rmr', canCreateMissions: false, canCreateEvents: true },
    ];
    const orgs = OrganizationStore.memory(seed);
    const partners = (id: string) => orgs.siteConfig(orgs.get(id)!, { devSignIn: false, buildId: '' }).organization.partners.map((p) => [p.id, p.canCreateMissions, p.canCreateEvents]);
    // CRT's own entry for RMR wins over the umbrella's.
    expect(partners('org-crt')).toEqual([
      ['org-rmr', true, false],
      ['org-sheriff', true, false],
    ]);
    // RMR doesn't get itself as a partner.
    expect(partners('org-rmr')).toEqual([['org-sheriff', true, false]]);

    // It operates with the rest of its tree and its partners, but not itself.
    const operational = (id: string) => orgs.siteConfig(orgs.get(id)!, { devSignIn: false, buildId: '' }).operational.map((u) => [u.id, u.seesOwners] as const);
    expect(operational('org-crt')).toEqual([
      ['org-cvsc', ['org-cvsc', 'org-sheriff', 'org-rmr']],
      ['org-rmr', ['org-rmr', 'org-cvsc', 'org-sheriff']],
      ['org-sheriff', ['org-sheriff']],
    ]);
    expect(operational('org-sheriff')).toEqual([]);
  });

  it("shows a site the activities it's on, owns, or owned by it, one above it, or a partner of either, missions included", () => {
    const seed = testSeed();
    seed.organizations.push({ ...seed.organizations[2]!, id: 'org-sheriff', parentId: null, title: 'Sheriff', hostnames: [], emailDomains: [], partners: [] });
    seed.organizations[0]!.partners = [{ id: 'org-sheriff', canCreateMissions: true, canCreateEvents: false }];
    const orgs = OrganizationStore.memory(seed);
    for (const kind of ['mission', 'training'] as const) {
      const sees = (site: string, ownerOrgId: string, unitIds: string[] = []) => orgs.seesActivity(site, { kind, ownerOrgId, unitIds });
      expect(sees('org-rmr', 'org-rmr')).toBe(true);
      // The umbrella's, and its partner's.
      expect(sees('org-rmr', 'org-cvsc')).toBe(true);
      expect(sees('org-rmr', 'org-sheriff')).toBe(true);
      // Not a sibling's, unless it names the owner as a partner or is on it.
      expect(sees('org-rmr', 'org-crt')).toBe(false);
      expect(sees('org-crt', 'org-rmr')).toBe(true);
      expect(sees('org-rmr', 'org-crt', ['org-crt', 'org-rmr'])).toBe(true);
      // Nor, for the umbrella, those below it, nor the sheriff the umbrella's.
      expect(sees('org-cvsc', 'org-crt')).toBe(false);
      expect(sees('org-sheriff', 'org-cvsc')).toBe(false);
    }
  });

  it('keeps the legacy id when a save leaves it out', async () => {
    const seed = testSeed();
    seed.organizations[0]!.legacyId = '5';
    const store = OrganizationStore.memory(seed, { envAdmins: [SITE_ADMIN] });
    const { legacyId: _legacyId, ...edited } = store.get(seed.organizations[0]!.id)!;
    expect(await store.save({ ...edited, title: 'Renamed' }, SITE_ADMIN)).toMatchObject({ ok: true, saved: { title: 'Renamed', legacyId: '5' } });
  });

  it('lets admins of an organization edit those under it too', () => {
    const seed = testSeed();
    seed.organizations[0]!.admins = ['umbrella@cvsc.example.org'];
    const orgs = OrganizationStore.memory(seed);
    expect(orgs.editableBy('umbrella@cvsc.example.org').map((o) => o.id).sort()).toEqual(['org-crt', 'org-cvsc', 'org-rmr']);
    expect(orgs.editableBy('harper.okonkwo@crt.example.org').map((o) => o.id)).toEqual(['org-crt']);
    expect(orgs.editableBy(undefined)).toEqual([]);
  });

  it.runIf(hasPostgres)('keeps changes in Postgres, with secrets encrypted; a seed import replaces only what it names', async () => {
    const name = `sync_test_${randomId().slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    await admin(`CREATE DATABASE ${name}`);
    const url = new URL(POSTGRES_BASE);
    url.pathname = `/${name}`;
    try {
      const secrets = new SecretBox(randomBytes(32).toString('base64'));
      const first = await OrganizationStore.connect(url.toString(), { secrets });
      expect(first.all()).toEqual([]);
      await first.importSeed(testSeed());
      const cedar = { id: 'cedar', kind: 'cedar', url: 'https://cedar.test', tokenUrl: 'https://hydra.test/oauth2/token', clientId: 'sync', clientSecret: 'hunter2' } as const;
      expect((await first.saveProvider(cedar, SITE_ADMIN)).ok).toBe(true);
      const rmr = first.get('org-rmr')!;
      expect((await first.save({ ...rmr, title: 'Ridgeline', memberTags: { Rope: 'Rope' } }, SITE_ADMIN)).ok).toBe(true);
      await first.setSiteAdmins(['other@example.org']);
      await first.close();

      // Again, with a changed CRT and the cedar provider without its secret.
      const second = await OrganizationStore.connect(url.toString(), { secrets });
      expect(second.get('org-rmr')?.title).toBe('Ridgeline');
      const seed = testSeed();
      seed.organizations = seed.organizations.filter((o) => o.id !== 'org-rmr');
      seed.organizations[1]!.title = 'Cascade Rescue';
      seed.memberProviders.push({ ...cedar, clientSecret: undefined, clientId: 'sync2' });
      await second.importSeed(seed);
      expect(second.get('org-crt')?.title).toBe('Cascade Rescue');
      expect(second.get('org-rmr')?.title).toBe('Ridgeline');
      expect(second.memberProvider('cedar')?.config).toMatchObject({ clientId: 'sync2', clientSecret: 'hunter2' });
      expect(second.siteAdmins().stored).toEqual([SITE_ADMIN, 'other@example.org']);
      // One that doesn't hang together writes nothing.
      const broken = testSeed();
      broken.organizations = [{ ...broken.organizations[1]!, title: 'Broken', parentId: 'org-missing' }];
      await expect(second.importSeed(broken)).rejects.toThrow("org-crt's parent org-missing doesn't exist");
      expect(second.get('org-crt')?.title).toBe('Cascade Rescue');
      await second.close();

      // The database holds the secret only encrypted, and another key can't open it.
      const client = new pg.Client({ connectionString: url.toString() });
      await client.connect();
      const { rows } = await client.query<{ data: { clientSecret: string } }>("SELECT data FROM member_providers WHERE id = 'cedar'");
      await client.end();
      expect(rows[0]?.data.clientSecret).toMatch(/^v1:/);
      expect(JSON.stringify(rows)).not.toContain('hunter2');
      const third = await OrganizationStore.connect(url.toString(), { secrets: new SecretBox(randomBytes(32).toString('base64')) });
      expect(third.get('org-crt')?.title).toBe('Cascade Rescue');
      expect(() => third.memberProvider('cedar')).toThrow('SECRETS_KEY has changed');
      await third.close();
    } finally {
      await admin(`DROP DATABASE ${name} WITH (FORCE)`);
    }
  });
});
