import { randomBytes } from 'crypto'

// In-memory session store — swap for Redis/Mongo in production if you need persistence across restarts
const sessions = new Map<string, Session>()

export interface Session {
  id: string
  userId: string
  email: string
  name: string
  picture?: string
  expiresAt: Date
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export async function createSession(userId: string, email: string, name: string, picture?: string): Promise<string> {
  const id = randomBytes(32).toString('base64url')
  const session: Session = {
    id,
    userId,
    email,
    name,
    picture,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  }
  sessions.set(id, session)
  return id
}

export function getSession(id: string): Session | null {
  const session = sessions.get(id)
  if (!session) return null
  if (session.expiresAt < new Date()) {
    sessions.delete(id)
    return null
  }
  return session
}

export function deleteSession(id: string) {
  sessions.delete(id)
}