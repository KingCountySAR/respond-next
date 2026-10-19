/**
 * `npm run seed -- <file>`: imports a seed file's member providers, organizations and site admins
 * into the database (DATABASE_URL). Each provider and organization replaces any stored one with its
 * id; nothing else is touched. A running server sees the changes once restarted.
 */
import { readFileSync } from 'node:fs';
import { OrganizationSeed } from '@sync/domain';
import { OrganizationStore } from './organizations';
import { SecretBox } from './secrets';

const file = process.argv[2];
const url = process.env.DATABASE_URL;
if (!file) fail('usage: npm run seed -- <seed file>');
if (!url) fail('DATABASE_URL is not set');

const parsed = OrganizationSeed.safeParse(JSON.parse(readFileSync(file, 'utf8')));
if (!parsed.success) fail(`${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
const seed = parsed.data;

const store = await OrganizationStore.connect(url, { secrets: new SecretBox(process.env.SECRETS_KEY) });
try {
  await store.importSeed(seed);
  const where = new URL(url);
  console.log(`${where.host}${where.pathname}: imported ${seed.memberProviders.length} member providers, ${seed.organizations.length} organizations and ${seed.siteAdmins.length} site admins from ${file}. Restart a running server to see them.`);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
} finally {
  await store.close();
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
