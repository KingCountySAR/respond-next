/**
 * `npm run seed -- <file>`: imports a seed file's member and sign-in providers, organizations and
 * site admins into the database (DATABASE_URL). Each provider and organization replaces any stored one with its
 * id; nothing else is touched. A running server sees the changes once restarted.
 *
 * The build bundles it as `dist/seed.mjs` (`node seed.mjs <file>`); `-` reads the file from standard
 * input, so a deployment can be seeded without the file, and its secrets, landing on the server's disk.
 */
import { readFileSync } from 'node:fs';
import { OrganizationSeed } from '@sync/domain';
import { OrganizationStore } from './organizations';
import { SecretBox } from './secrets';

const file = process.argv[2];
const url = process.env.DATABASE_URL;
if (!file) fail('usage: npm run seed -- <seed file>, or - for standard input');
if (!url) fail('DATABASE_URL is not set');

const parsed = OrganizationSeed.safeParse(JSON.parse(readFileSync(file === '-' ? 0 : file, 'utf8')));
if (!parsed.success) fail(`${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
const seed = parsed.data;

const store = await OrganizationStore.connect(url, { secrets: new SecretBox(process.env.SECRETS_KEY) });
try {
  await store.importSeed(seed);
  const where = new URL(url);
  console.log(`${where.host}${where.pathname}: imported ${seed.memberProviders.length} member providers, ${seed.signInProviders.length} sign-in providers, ${seed.organizations.length} organizations and ${seed.siteAdmins.length} site admins from ${file === '-' ? 'standard input' : file}. Restart a running server to see them.`);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
} finally {
  await store.close();
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
