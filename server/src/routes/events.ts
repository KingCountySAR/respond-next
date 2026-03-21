import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { withApiLogin } from '../middleware/auth'

export const eventsRoutes = new Hono()

// Example SSE endpoint — replace the interval with your real event source
// e.g. MongoDB change streams, pub/sub, polling, etc.
eventsRoutes.get('/stream', withApiLogin, (c) => {
  return streamSSE(c, async (stream) => {
    let count = 0

    // Send an initial connection acknowledgement
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ message: 'Stream connected' }),
    })

    // Example: push an update every 5 seconds
    // Replace with your actual data source
    const interval = setInterval(async () => {
      await stream.writeSSE({
        event: 'update',
        data: JSON.stringify({ count: ++count, timestamp: new Date().toISOString() }),
        id: String(count),
      })
    }, 5000)

    // Clean up when the client disconnects
    stream.onAbort(() => {
      clearInterval(interval)
    })

    // Keep the stream open
    await new Promise<void>((resolve) => stream.onAbort(resolve))
  })
})