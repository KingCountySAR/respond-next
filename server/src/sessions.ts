import { randomBytes } from 'node:crypto';

import type UserAuth from '@respond/shared/types/userAuth';

import mongoPromise from './mongodb';

export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 1 day
// Slide the expiry forward once a session is more than halfway to expiring, so
// active users stay logged in without a Mongo write on every single request.
const REFRESH_THRESHOLD_MS = (SESSION_TTL_SECONDS * 1000) / 2;
const COLLECTION = 'sessions';

/**
 * A server-side session. The cookie only carries the opaque `_id`; the auth
 * payload lives here in Mongo so it can be revoked and never leaves the server.
 * The `expires` field is TTL-indexed (see mongodb.ts) for automatic cleanup.
 */
interface SessionDoc {
  _id: string;
  auth: UserAuth;
  created: Date;
  expires: Date;
}

export interface SessionResult {
  auth: UserAuth;
  /** True when this lookup slid the expiry forward — caller should refresh the cookie. */
  refreshed: boolean;
}

async function sessions() {
  return (await mongoPromise).db().collection<SessionDoc>(COLLECTION);
}

/** Create a session for `auth` and return its opaque id (the cookie value). */
export async function createSession(auth: UserAuth): Promise<string> {
  const id = randomBytes(32).toString('hex');
  const now = new Date();
  await (
    await sessions()
  ).insertOne({
    _id: id,
    auth,
    created: now,
    expires: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000),
  });
  return id;
}

/**
 * Look up the auth for a session id, treating an expired session as absent.
 * Rolls the expiry forward when the session is more than halfway to expiring;
 * `refreshed` tells the caller to re-set the cookie with a fresh max-age.
 */
export async function getSession(id: string): Promise<SessionResult | undefined> {
  const col = await sessions();
  const doc = await col.findOne({ _id: id });
  if (!doc) return undefined;
  const now = Date.now();
  if (doc.expires.getTime() < now) {
    await col.deleteOne({ _id: id });
    return undefined;
  }
  let refreshed = false;
  if (doc.expires.getTime() - now < REFRESH_THRESHOLD_MS) {
    await col.updateOne({ _id: id }, { $set: { expires: new Date(now + SESSION_TTL_SECONDS * 1000) } });
    refreshed = true;
  }
  return { auth: doc.auth, refreshed };
}

export async function deleteSession(id: string): Promise<void> {
  await (await sessions()).deleteOne({ _id: id });
}
