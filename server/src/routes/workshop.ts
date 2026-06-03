import { Hono } from 'hono'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/client'
import { workshopItems, purchaseRecords } from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'
import { evaluateAlerts } from '../lib/alerts'

const workshopRoutes = new Hono()
workshopRoutes.use('*', requireAuth)

workshopRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const items = await db
    .select()
    .from(workshopItems)
    .where(eq(workshopItems.user_id, userId))
    .orderBy(asc(workshopItems.category), asc(workshopItems.name))
  return ok(c, items)
})

workshopRoutes.post('/', async (c) => {
  const userId = c.get('userId')

  type Body = {
    category: string
    name: string
    spec?: object
    unit?: string
    quantity?: number
    low_stock_threshold?: number
    reorder_url?: string
    storage_location?: string
    notes?: string
    // Inline purchase capture
    price_paid?: number
    source_name?: string
    purchase_date?: string
  }

  const body = await c.req.json<Body>()
  if (!body.category) return err(c, 'category is required')
  if (!body.name)     return err(c, 'name is required')

  const [created] = await db
    .insert(workshopItems)
    .values({
      user_id:             userId,
      category:            body.category,
      name:                body.name.trim(),
      spec:                body.spec ?? null,
      unit:                body.unit ?? 'pcs',
      quantity:            body.quantity?.toString() ?? '0',
      low_stock_threshold: body.low_stock_threshold?.toString() ?? '5',
      reorder_url:         body.reorder_url?.trim() ?? null,
      storage_location:    body.storage_location?.trim() ?? null,
      notes:               body.notes?.trim() ?? null,
    })
    .returning()

  // Inline purchase record when a price was entered — feeds price history + spend dashboard
  if (body.price_paid != null && !isNaN(Number(body.price_paid))) {
    const qty = body.quantity && body.quantity > 0 ? body.quantity : 1
    await db.insert(purchaseRecords).values({
      user_id:        userId,
      item_type:      'workshop_item',
      item_ref_id:    created.id,
      purchase_date:  body.purchase_date ?? new Date().toISOString().split('T')[0],
      quantity:       qty,
      price_per_unit: body.price_paid.toString(),
      total_paid:     (body.price_paid * qty).toString(),
      currency:       'USD',
      product_title:  created.name,
      notes:          body.source_name ? `Source: ${body.source_name.trim()}` : null,
    })
  }

  evaluateAlerts(userId).catch((e) => console.error('[alerts]', e))
  return ok(c, created, 201)
})

workshopRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id     = c.req.param('id')

  const body = await c.req.json<Record<string, unknown>>()

  const numericFields = ['quantity', 'low_stock_threshold']
  const allowed = ['category', 'name', 'spec', 'unit', 'quantity',
    'low_stock_threshold', 'reorder_url', 'storage_location', 'notes']

  const updates: Record<string, unknown> = {}
  for (const f of allowed) {
    if (f in body) {
      updates[f] = numericFields.includes(f) && body[f] != null
        ? String(body[f])
        : body[f] ?? null
    }
  }

  if (Object.keys(updates).length === 0) return err(c, 'No valid fields')

  const [updated] = await db
    .update(workshopItems)
    .set(updates)
    .where(and(eq(workshopItems.id, id), eq(workshopItems.user_id, userId)))
    .returning()

  if (!updated) return err(c, 'Item not found', 404)
  evaluateAlerts(userId).catch((e) => console.error('[alerts]', e))
  return ok(c, updated)
})

workshopRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id     = c.req.param('id')

  const deleted = await db
    .delete(workshopItems)
    .where(and(eq(workshopItems.id, id), eq(workshopItems.user_id, userId)))
    .returning({ id: workshopItems.id })

  if (deleted.length === 0) return err(c, 'Item not found', 404)
  return ok(c, { deleted: true })
})

/**
 * POST /api/workshop/import-kit
 * Creates multiple workshop items from a kit template in one request.
 */
workshopRoutes.post('/import-kit', async (c) => {
  const userId = c.get('userId')

  type KitBody = {
    kit_name: string
    items: Array<{
      category: string
      name: string
      spec?: object
      unit?: string
      quantity: number
    }>
    purchase_record_id?: string
  }

  const body = await c.req.json<KitBody>()
  if (!body.kit_name) return err(c, 'kit_name is required')
  if (!body.items?.length) return err(c, 'items array is required')

  const created = await db
    .insert(workshopItems)
    .values(
      body.items.map((item) => ({
        user_id:             userId,
        category:            item.category,
        name:                item.name,
        spec:                item.spec ?? null,
        unit:                item.unit ?? 'pcs',
        quantity:            item.quantity.toString(),
        low_stock_threshold: '5',
        source_kit_id:       body.purchase_record_id ?? null,
      })),
    )
    .returning()

  return ok(c, { kit_name: body.kit_name, created }, 201)
})

export default workshopRoutes
