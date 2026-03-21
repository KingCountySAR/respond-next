import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { getSession, type Session } from '../lib/session.js'

// Extend Hono's context variables type
export type AuthVariables = {
  login: Required<Pick<Session, 'login'>>['login']
}

export const withApiLogin = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const errorBody = { error: 'Unauthorized' }
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return c.json(errorBody, 401)

  const session = getSession(c, false)
  if (!session?.login) return c.json(errorBody, 401)

  c.set('login', session.login)

  await next()
})