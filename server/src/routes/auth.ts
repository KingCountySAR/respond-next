import { Hono } from 'hono'
import { googleAuth } from '@hono/oauth-providers/google'
import { setCookie, deleteCookie } from 'hono/cookie'
import { getDb } from '../db/mongo'
import { createSession, deleteSession, getSession } from '../lib/session.js'
import { requireAuth } from '../middleware/auth'

export const authRoutes = new Hono()

// Kick off Google OAuth flow
authRoutes.use(
  '/google',
  googleAuth({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    scope: ['openid', 'email', 'profile'],
  })
)

// Google redirects back here after login
authRoutes.get('/google', async (c) => {
  const googleUser = c.get('user-google')
  if (!googleUser?.email) return c.redirect('/login?error=no_email')

  const db = getDb()

  // ✅ Check the email exists in your users collection before allowing login
  const existingUser = await db.collection('users').findOne({ email: googleUser.email })
  if (!existingUser) {
    return c.redirect('/login?error=unauthorized')
  }

  const sessionId = await createSession(
    existingUser._id.toString(),
    googleUser.email,
    googleUser.name ?? '',
    googleUser.picture ?? undefined
  )

  setCookie(c, 'session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return c.redirect('/app')
})

authRoutes.post('/logout', requireAuth, async (c) => {
  const session = c.get('session')
  deleteSession(session.id)
  deleteCookie(c, 'session')
  return c.json({ ok: true })
})

// Handy endpoint for the frontend to check who's logged in
authRoutes.get('/me', requireAuth, (c) => {
  const session = c.get('session')
  return c.json({
    id: session.userId,
    email: session.email,
    name: session.name,
    picture: session.picture,
  })
})