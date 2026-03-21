import { Hono } from 'hono'
import { deleteCookie } from 'hono/cookie'
import { getDb } from '../db/mongo.js'
import { updateSession, deleteSession, getSession } from '../lib/session'

export const authRoutes = new Hono()

// Verify a Google ID token and exchange it for a session cookie.
// The token is obtained entirely client-side via Google Identity Services —
// no redirect URI registration required, only Authorized JavaScript Origins.
authRoutes.post('/google', async (c) => {
  const { credential } = await c.req.json<{ credential?: string }>()
  if (!credential) return c.json({ error: 'Missing credential' }, 400)

  // Verify the JWT with Google's tokeninfo endpoint.
  // For higher volume, verify locally using Google's public keys instead.
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`)
  if (!res.ok) return c.json({ error: 'Invalid token' }, 401)

  const payload = await res.json() as {
    sub: string
    email?: string
    name?: string
    picture?: string
    aud?: string
    exp?: string
    hd?: string
  }

  // Ensure the token was issued for your client ID, not someone else's app
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
    return c.json({ error: 'Token audience mismatch' }, 401)
  }

  // Ensure the token hasn't expired (tokeninfo does this too, but be explicit)
  if (!payload.exp || Date.now() / 1000 > Number(payload.exp)) {
    return c.json({ error: 'Token expired' }, 401)
  }

  if (!payload.email) return c.json({ error: 'No email in token' }, 401)

  const db = getDb()
  // const existingUser = await db.collection('users').findOne({ email: payload.email })
  // if (!existingUser) return c.json({ error: 'Unauthorized' }, 403)

  const login = {
      id: payload.sub,
      name: payload.name ?? 'Unknown',
      email: payload.email,
      picture: payload.picture,
    }

  await updateSession(getSession(c, true), { login })
  const { id, ...clientLogin } = login;
  return c.json({ ok: true, login: clientLogin })
})

authRoutes.post('/logout', async (c) => {
  const session = getSession(c)
  if (session) {
    deleteSession(session.id)
    deleteCookie(c, 'session')
  }
  return c.json({ ok: true })
})

authRoutes.get('/me', (c) => {
  const session = getSession(c, false)
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (session?.login) {
    // Hide the id from the client
    const { id, ...login } = session.login
    return c.json({ login, clientId })
  } else {
    return c.json({ clientId })
  }
})