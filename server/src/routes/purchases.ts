import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client'
import { purchaseRecords, purchaseSources } from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'

const purchaseRoutes = new Hono()
purchaseRoutes.use('*', requireAuth)

// ── Purchase sources ──────────────────────────────────────────

purchaseRoutes.get('/sources', async (c) => {
  const userId = c.get('userId')
  const sources = await db
    .select()
    .from(purchaseSources)
    .where(eq(purchaseSources.user_id, userId))

  // Merge with global pre-seeded sources (user_id = null)
  // For now return user sources only — seed data will be added separately
  return ok(c, sources)
})

purchaseRoutes.post('/sources', async (c) => {
  const userId = c.get('userId')

  type Body = {
    name: string
    domain?: string
    source_type?: string
    is_official?: boolean
    affiliate_program?: string
    reliability_note?: string
    shipping_note?: string
  }

  const body = await c.req.json<Body>()
  if (!body.name) return err(c, 'name is required')

  const [created] = await db
    .insert(purchaseSources)
    .values({
      name:              body.name.trim(),
      domain:            body.domain?.trim() ?? null,
      source_type:       body.source_type ?? null,
      is_official:       body.is_official ?? false,
      affiliate_program: body.affiliate_program ?? null,
      reliability_note:  body.reliability_note?.trim() ?? null,
      shipping_note:     body.shipping_note?.trim() ?? null,
      user_id:           userId,
    })
    .returning()

  return ok(c, created, 201)
})

// ── Purchase records ──────────────────────────────────────────

purchaseRoutes.get('/', async (c) => {
  const userId = c.get('userId')

  const records = await db
    .select({
      record: purchaseRecords,
      source_name: purchaseSources.name,
      source_domain: purchaseSources.domain,
    })
    .from(purchaseRecords)
    .leftJoin(purchaseSources, eq(purchaseRecords.source_id, purchaseSources.id))
    .where(eq(purchaseRecords.user_id, userId))
    .orderBy(desc(purchaseRecords.purchase_date))

  return ok(c, records)
})

purchaseRoutes.post('/', async (c) => {
  const userId = c.get('userId')

  type Body = {
    item_type: string
    item_ref_id?: string
    purchase_date: string
    quantity?: number
    price_per_unit?: number
    total_paid?: number
    currency?: string
    source_id?: string
    product_url?: string
    product_title?: string
    order_id?: string
    was_on_sale?: boolean
    coupon_code?: string
    is_secondhand?: boolean
    notes?: string
  }

  const body = await c.req.json<Body>()
  if (!body.item_type)     return err(c, 'item_type is required')
  if (!body.purchase_date) return err(c, 'purchase_date is required')

  const [created] = await db
    .insert(purchaseRecords)
    .values({
      user_id:        userId,
      item_type:      body.item_type,
      item_ref_id:    body.item_ref_id ?? null,
      purchase_date:  body.purchase_date,
      quantity:       body.quantity ?? 1,
      price_per_unit: body.price_per_unit?.toString() ?? null,
      total_paid:     body.total_paid?.toString() ?? null,
      currency:       body.currency ?? 'USD',
      source_id:      body.source_id ?? null,
      product_url:    body.product_url?.trim() ?? null,
      product_title:  body.product_title?.trim() ?? null,
      order_id:       body.order_id?.trim() ?? null,
      was_on_sale:    body.was_on_sale ?? false,
      coupon_code:    body.coupon_code?.trim() ?? null,
      is_secondhand:  body.is_secondhand ?? false,
      notes:          body.notes?.trim() ?? null,
    })
    .returning()

  return ok(c, created, 201)
})

// ── Price history ─────────────────────────────────────────────

purchaseRoutes.get('/price-history/:itemType/:itemId', async (c) => {
  const userId   = c.get('userId')
  const itemType = c.req.param('itemType')
  const itemId   = c.req.param('itemId')

  const records = await db
    .select({
      purchase_date:  purchaseRecords.purchase_date,
      price_per_unit: purchaseRecords.price_per_unit,
      total_paid:     purchaseRecords.total_paid,
      quantity:       purchaseRecords.quantity,
      source_name:    purchaseSources.name,
    })
    .from(purchaseRecords)
    .leftJoin(purchaseSources, eq(purchaseRecords.source_id, purchaseSources.id))
    .where(
      and(
        eq(purchaseRecords.user_id, userId),
        eq(purchaseRecords.item_type, itemType),
        eq(purchaseRecords.item_ref_id, itemId),
      ),
    )
    .orderBy(desc(purchaseRecords.purchase_date))

  return ok(c, records)
})

export default purchaseRoutes
