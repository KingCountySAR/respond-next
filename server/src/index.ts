import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import './config'
import { connectDb } from './db/mongo.js'
import { authRoutes } from './routes/auth.js'
import { eventsRoutes } from './routes/events.js'
import { apiRoutes } from './routes/api.js'

// In production, the client build output is expected at ../../client/dist
// relative to the compiled server — adjust if your build layout differs
const CLIENT_DIST = resolve(process.cwd(), './static')

const app = new Hono()

// Middleware
app.use('*', logger())

// // CORS only needed in dev — in prod the client is served from the same origin
// if (!isProd) {
//   app.use(
//     '*',
//     cors({
//       origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
//       credentials: true,
//     })
//   )
// }

// Routes
app.route('/api/auth', authRoutes)
app.route('/events', eventsRoutes)
app.route('/api', apiRoutes)

// Health check
app.get('/health', (c) => c.json({ ok: true }))

// Static assets (JS/CSS/images from Vite build)
//if (isProd) {
  app.use('*', serveStatic({ root: CLIENT_DIST }))

  // SPA fallback — any unmatched route serves index.html so React Router can handle it
  app.get('*', (c) => {
    const html = readFileSync(resolve(CLIENT_DIST, 'index.html'), 'utf-8')
    return c.html(html)
  })
//}

// Boot
const PORT = Number(process.env.PORT ?? 3000)

connectDb().then(() => {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`Server running at http://localhost:${PORT}`)
  })
})

// Export the app type for Hono RPC — import this in the client for end-to-end types
export type AppType = typeof app