/**
 * `npm run import-legacy -- <export folder> [--dry-run]`: imports respond-next's activities and saved
 * locations into the database (DATABASE_URL), from a `mongoexport --jsonArray` of its collections
 * (`<db>.activities.json` and `<db>.locations.json` in the folder). Seed the organizations first:
 * each legacy organization id must be some organization's `legacyId`.
 *
 * Activities and saved locations already here are skipped, so it can be run again: after a dry run
 * against a copy, or with a newer export at cut-over. Every activity is converted before anything
 * is written; one that can't be stops the run. Restart a running server afterwards: on start it adds
 * the new activities to the list and archive.
 *
 * The build bundles it as `dist/import-legacy.mjs` (`node import-legacy.mjs <folder>`).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PostgresStorage } from '@sync/server';
import { ConversionError, IMPORT_VERSION, convertActivity, convertLocation, legacyOrgIds, type Converted, type LegacyActivity, type LegacyOrganizations } from './legacy';
import { PostgresLocationCatalog } from './locations';
import { OrganizationStore } from './organizations';
import { SecretBox } from './secrets';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const folder = args.find((a) => !a.startsWith('--'));
const url = process.env.DATABASE_URL;
if (!folder) fail('usage: npm run import-legacy -- <export folder> [--dry-run]');
if (!url) fail('DATABASE_URL is not set');

/** The one file in the folder whose name ends with `suffix`. */
function exported<T>(suffix: string): T[] {
  const names = readdirSync(folder!).filter((n) => n.endsWith(suffix));
  if (names.length !== 1) fail(`${folder}: expected one *${suffix}, found ${names.length ? names.join(', ') : 'none'}`);
  return JSON.parse(readFileSync(path.join(folder!, names[0]!), 'utf8')) as T[];
}

const activities = exported<LegacyActivity>('.activities.json');
const locations = exported<Parameters<typeof convertLocation>[0] & { isSaved?: boolean }>('.locations.json');

const store = await OrganizationStore.connect(url, { secrets: new SecretBox(process.env.SECRETS_KEY) });
const mapped = store.all().filter((o) => o.legacyId !== undefined);
const orgs: LegacyOrganizations = {
  byLegacyId: (id) => mapped.find((o) => o.legacyId === id),
  all: () => mapped,
  providerOf: (id) => store.providerOf(id),
};
await store.close();

const unmapped = [...legacyOrgIds(activities)].filter((id) => !orgs.byLegacyId(id));
if (unmapped.length) fail(`No organization has legacyId ${unmapped.sort().join(', ')}. Add them to the seed file and seed again.`);

const converted: Converted[] = [];
const failures: string[] = [];
for (const a of activities) {
  try {
    converted.push(convertActivity(a, orgs));
  } catch (err) {
    if (!(err instanceof ConversionError)) throw err;
    failures.push(`${a.id} (${a.title}): ${err.message}`);
  }
}
if (failures.length) fail(`Nothing imported; ${failures.length} activities can't be converted:\n  ${failures.join('\n  ')}`);

const storage = await PostgresStorage.connect(url);
const catalog = await PostgresLocationCatalog.connect(url);
try {
  const existing = new Set(await storage.activityIds());
  const toWrite = converted.filter((c) => !existing.has(c.id));
  const savedIds = new Set((await catalog.search('')).map((l) => l.id));
  const newLocations = locations.filter((l) => l.isSaved !== false && !savedIds.has(l.id)).map(convertLocation);
  const untitled = newLocations.filter((l) => !l).length;

  if (!dryRun) {
    for (const c of toWrite) await storage.commit(c.id, { fromVersion: 0, version: IMPORT_VERSION, records: c.records, lastMutationIds: {}, log: [] });
    for (const l of newLocations) if (l) await catalog.put(l);
  }

  const notes = new Map<string, number>();
  for (const c of toWrite) for (const n of c.notes) notes.set(n, (notes.get(n) ?? 0) + 1);
  const where = new URL(url);
  console.log(`${where.host}${where.pathname}${dryRun ? ' (dry run: nothing written)' : ''}:`);
  console.log(`  activities: ${toWrite.length} ${dryRun ? 'to import' : 'imported'} (${toWrite.reduce((n, c) => n + c.records.length, 0)} records), ${converted.length - toWrite.length} already here`);
  console.log(`  saved locations: ${newLocations.length - untitled} ${dryRun ? 'to import' : 'imported'}, ${locations.length - newLocations.length} already here or not saved${untitled ? `, ${untitled} without a title left out` : ''}`);
  for (const [note, n] of notes) console.log(`  ${n} × ${note}`);
  if (!dryRun && toWrite.length) console.log('Restart a running server to add the imported activities to its list and archive.');
} finally {
  await storage.close();
  await catalog.close();
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
