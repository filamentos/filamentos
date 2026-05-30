import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { alerts } from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'
import { evaluateAlerts } from '../lib/alerts'

const alertRoutes = new Hono()
alertRoutes.use('*', requireAuth)

/**
 * GET /api/alerts
 * Returns all active (unread + undismissed) alerts, newest first.
 */
alertRoutes.get('/', async (c) => {
  const userId = c.get('userId')

  const active = await db
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.user_id, userId),
        eq(alerts.is_dismissed, false),
      ),
    )
    .orderBy(desc(alerts.created_at))

  return ok(c, active)
})

/**
 * POST /api/alerts/:id/read
 */
alertRoutes.post('/:id/read', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [updated] = await db
    .update(alerts)
    .set({ is_read: true })
    .where(and(eq(alerts.id, id), eq(alerts.user_id, userId)))
    .returning()

  if (!updated) return err(c, 'Alert not found', 404)
  return ok(c, updated)
})

/**
 * POST /api/alerts/:id/dismiss
 */
alertRoutes.post('/:id/dismiss', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [updated] = await db
    .update(alerts)
    .set({ is_dismissed: true, is_read: true })
    .where(and(eq(alerts.id, id), eq(alerts.user_id, userId)))
    .returning()

  if (!updated) return err(c, 'Alert not found', 404)
  return ok(c, updated)
})

/**
 * POST /api/alerts/evaluate
 * Manually trigger alert evaluation (used by dashboard + future cron).
 */
alertRoutes.post('/evaluate', async (c) => {
  const userId = c.get('userId')
  await evaluateAlerts(userId)
  return ok(c, { evaluated: true })
})

export default alertRoutes
