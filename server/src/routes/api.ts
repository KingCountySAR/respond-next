import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { getDb } from '../db/mongo'
import type { Session } from '../lib/session'

type Variables = { session: Session }

export const apiRoutes = new Hono<{ Variables: Variables }>()

// All API routes require auth
apiRoutes.use('*', requireAuth)

// Example CRUD route — replace with your actual domain models
apiRoutes.get('/items', async (c) => {
  const db = getDb()
  const items = await db.collection('items').find().toArray()
  return c.json(items)
})

apiRoutes.post(
  '/items',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    })
  ),
  async (c) => {
    const body = c.req.valid('json')
    const session = c.get('session')
    const db = getDb()

    const result = await db.collection('items').insertOne({
      ...body,
      createdBy: session.userId,
      createdAt: new Date(),
    })

    return c.json({ id: result.insertedId }, 201)
  }
)