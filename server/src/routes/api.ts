import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { AuthVariables, withApiLogin } from '../middleware/auth'
import { getDb } from '../db/mongo'

export const apiRoutes = new Hono<{ Variables: AuthVariables }>()

// All API routes require auth
apiRoutes.use('*', withApiLogin)

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
    const login = c.get('login')
    const db = getDb()

    const result = await db.collection('items').insertOne({
      ...body,
      createdBy: login.id,
      createdAt: new Date(),
    })

    return c.json({ id: result.insertedId }, 201)
  }
)