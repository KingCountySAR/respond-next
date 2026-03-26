import { randomBytes } from 'crypto';


import { SessionDoc, SESSIONS_COLLECTION } from '@server/db/index.js';
import { getDb } from '@server/db/mongo.js';
import { SessionLogin } from '@server/model/auth.js';
import { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

export interface Session {
  id: string
  login?: SessionLogin
  expiresAt: Date
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function updateSession(session: Session, update: Partial<Omit<Session, 'id'>>) {
  const updated = { ...session, ...update };
  setSession(updated);
  return updated;
}

function createSession(): Session {
  const session: Session = {
    id: randomBytes(32).toString('base64url'),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  };
  return session;
}

export function getSession(c: Context, create?: false): Promise<Session | undefined>;
export function getSession(c: Context, create: true): Promise<Session>;
export async function getSession(c: Context, create?: boolean): Promise<Session | undefined> {
  let session: Session | undefined = undefined;
  const id = getCookie(c, 'session');
  if (id) {
    session = await getSessionFromDb(id);
    if (session && session.expiresAt < new Date()) {
      await deleteSession(id);
      session = undefined;
    }
  }

  if (!session && create) {
    session = createSession();
    setSession(session);
    setCookie(c, 'session', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
  }

  return session;
}

export async function deleteSession(id: string) {
  await getDb().collection<SessionDoc>(SESSIONS_COLLECTION).deleteOne({ sessionId: id });
}

async function getSessionFromDb(id: string): Promise<Session | undefined> {
  const doc = await getDb().collection<SessionDoc>(SESSIONS_COLLECTION).findOne({ sessionId: id });
  if (!doc) {
    return undefined;
  }
  return {
    ...doc.content,
    id: doc.sessionId,
    expiresAt: new Date(doc.expires),
  };
}

async function setSession(session: Session) {
  const { id, expiresAt, ...content } = session;
  await getDb()
    .collection<SessionDoc>(SESSIONS_COLLECTION)
    .replaceOne(
      { sessionId: id },
      {
        sessionId: id,
        version: 1,
        content,
        expires: expiresAt.toISOString(),
      },
      { upsert: true }
    );
}

export async function getUserFromSession(c: Context): Promise<SessionLogin | undefined> {
  const session = await getSession(c);
  return session?.login;
}
