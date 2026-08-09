// SEE https://github.com/vercel/next.js/tree/canary/examples/with-mongodb
import { OrganizationDoc, ORGS_COLLECTION } from '@respond/shared/types/data/organizationDoc';
import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options = {};

// The server runs as a single long-lived process (started once by
// server/src/index.ts, restarted wholesale by `tsx watch`), so a plain
// module-scoped client is sufficient — no HMR globalThis caching needed.
const client = new MongoClient(uri, options);
const clientPromise: Promise<MongoClient> = client.connect();

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise.then(async (m) => {
  // Server-side sessions live in the `sessions` collection; a TTL index on the
  // `expires` field lets Mongo reap them once they lapse (expireAfterSeconds: 0
  // means "delete when the indexed date is in the past").
  await m.db().collection('sessions').createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
  return m;
});

export async function getOrganizationForDomain(domain: string) {
  const client = await clientPromise;
  const organization = await client.db().collection<OrganizationDoc>(ORGS_COLLECTION).findOne({ domain });
  return organization;
}

export async function getOrganizationById(orgId: string) {
  const client = await clientPromise;
  const organization = await client.db().collection<OrganizationDoc>(ORGS_COLLECTION).findOne({ id: orgId });
  return organization;
}

export async function getRelatedOrgIds(orgId: string): Promise<string[]> {
  const mongo = await clientPromise;
  const userOrg = await mongo.db().collection<OrganizationDoc>('organizations').findOne({ id: orgId });
  if (!userOrg) return [];

  const myOrgIds = [userOrg.id, ...(userOrg.partners?.map((p) => p.id) ?? [])];
  return myOrgIds;
}
