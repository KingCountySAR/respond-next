import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import './config'
import { connectDb } from './db/mongo'
import { authRoutes } from './routes/auth'
import { eventsRoutes } from './routes/events'
import { setupApiRoutes } from './routes/api'
import { OrganizationService } from './svc/organizationService'
import { setupEnvironmentApi } from './routes/api/environmentApi'
import { EnvironmentService } from './svc/environmentService'

// In production, the client build output is expected at ../../client/dist
// relative to the compiled server — adjust if your build layout differs
const CLIENT_DIST = resolve(process.cwd(), './static')
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT_ID) {
  throw new Error('GOOGLE_CLIENT_ID missing from config');
}


const orgService = new OrganizationService();
const envService = new EnvironmentService(orgService);

const app = new Hono()

// Middleware
app.use('*', logger())

// Routes
app.route('/api/auth', authRoutes)
app.route('/events', eventsRoutes)
app.route('/api', setupApiRoutes())
app.route('/api', setupEnvironmentApi(envService, GOOGLE_CLIENT_ID));
app.get('/api', (c) => c.json({ error: 'Not found' }, 404))

// Health check
app.get('/health', (c) => c.json({ ok: true }))

// Static assets (JS/CSS/images from Vite build)
app.use('*', serveStatic({ root: CLIENT_DIST }))

// SPA fallback — any unmatched route serves index.html so React Router can handle it
app.get('*', (c) => {
  const html = readFileSync(resolve(CLIENT_DIST, 'index.html'), 'utf-8')
  return c.html(html)
})

// Boot
const PORT = Number(process.env.PORT ?? 3000)

connectDb().then(() => {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`Server running at http://localhost:${PORT}`)
  })
})

// Export the app type for Hono RPC — import this in the client for end-to-end types
export type AppType = typeof app