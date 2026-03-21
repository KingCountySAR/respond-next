import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { getSession, type Session } from '../lib/session.js'

// Extend Hono's context variables type
type AuthVariables = {
  session: Session
}

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json({ error: 'Unauthorized' }, 401)

  const session = getSession(sessionId)
  if (!session) return c.json({ error: 'Session expired' }, 401)

  c.set('session', session)
  await next()
})