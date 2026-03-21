import { randomBytes } from 'crypto'
import { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

// In-memory session store — swap for Redis/Mongo in production if you need persistence across restarts
const sessions = new Map<string, Session>()

export interface Session {
  id: string
  login?: {
    id: string
    email: string
    name: string
    picture?: string
  }
  expiresAt: Date
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export async function updateSession(session: Session, update: Partial<Omit<Session, 'id'>>) {
  const updated = { ...session, ...update }
  sessions.set(session.id, updated)
  return updated
}

function createSession(): Session {
  const session: Session = {
    id: randomBytes(32).toString('base64url'),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  }
  return session
}

export function getSession(c: Context<any, any, {}>, create?: false): Session | undefined;
export function getSession(c: Context<any, any, {}>, create: true): Session;
export function getSession(c: Context<any, any, {}>, create?: boolean): Session | undefined {
  let session: Session|undefined = undefined
  const id = getCookie(c, 'session')
  if (id) {
    session = sessions.get(id)
    if (session && session.expiresAt < new Date()) {
      sessions.delete(id)
      session = undefined
    }
  }
  
  if (!session && create) {
    session = createSession()
    sessions.set(session.id, session)
    setCookie(c, 'session', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
  }

  return session
}

export function deleteSession(id: string) {
  sessions.delete(id)
}