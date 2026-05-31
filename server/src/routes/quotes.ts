import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client'
import {
  quoteProjects,
  quoteLineItems,
  userQuoteSettings,
  workshopItems,
  spools,
  filamentProfiles,
  savedProjects,
} from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'
import { calculateTotals, sellThroughAdvice, beginnerTips } from '../lib/quoteCalculator'

const quoteRoutes = new Hono()
quoteRoutes.use('*', requireAuth)

// ── Quote settings ────────────────────────────────────────────

quoteRoutes.get('/settings', async (c) => {
  const userId = c.get('userId')
  const [settings] = await db
    .select()
    .from(userQuoteSettings)
    .where(eq(userQuoteSettings.user_id, userId))

  if (!settings) {
    // Return defaults
    return ok(c, {
      user_id: userId,
      electricity_rate_per_kwh: '0.14',
      default_printer_wattage_w: 200,
      labor_rate_per_hr: '15.00',
      include_electricity: true,
      include_labor: true,
      include_wear_costs: true,
      default_markup: '3.0',
      default_venue: 'farmers_market',
      default_packaging_cost: '0',
    })
  }
  return ok(c, settings)
})

quoteRoutes.patch('/settings', async (c) => {
  const userId = c.get('userId')
  type Body = Partial<{
    electricity_rate_per_kwh: number
    default_printer_wattage_w: number
    labor_rate_per_hr: number
    include_electricity: boolean
    include_labor: boolean
    include_wear_costs: boolean
    default_markup: number
    default_venue: string
    default_packaging_cost: number
  }>
  const body = await c.req.json<Body>()

  const setFields: Record<string, unknown> = { updated_at: new Date() }
  if (body.electricity_rate_per_kwh !== undefined) setFields.electricity_rate_per_kwh = body.electricity_rate_per_kwh.toString()
  if (body.default_printer_wattage_w !== undefined) setFields.default_printer_wattage_w = body.default_printer_wattage_w
  if (body.labor_rate_per_hr !== undefined) setFields.labor_rate_per_hr = body.labor_rate_per_hr.toString()
  if (body.include_electricity !== undefined) setFields.include_electricity = body.include_electricity
  if (body.include_labor !== undefined) setFields.include_labor = body.include_labor
  if (body.include_wear_costs !== undefined) setFields.include_wear_costs = body.include_wear_costs
  if (body.default_markup !== undefined) setFields.default_markup = body.default_markup.toString()
  if (body.default_venue !== undefined) setFields.default_venue = body.default_venue
  if (body.default_packaging_cost !== undefined) setFields.default_packaging_cost = body.default_packaging_cost.toString()

  await db
    .insert(userQuoteSettings)
    .values({ user_id: userId, ...setFields })
    .onConflictDoUpdate({
      target: userQuoteSettings.user_id,
      set: setFields,
    })

  const [updated] = await db
    .select()
    .from(userQuoteSettings)
    .where(eq(userQuoteSettings.user_id, userId))

  return ok(c, updated)
})

// ── List quotes ───────────────────────────────────────────────

quoteRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const quotes = await db
    .select()
    .from(quoteProjects)
    .where(eq(quoteProjects.user_id, userId))
    .orderBy(desc(quoteProjects.created_at))
  return ok(c, quotes)
})

// ── Create quote ──────────────────────────────────────────────

quoteRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  type Body = {
    name: string
    batch_quantity?: number
    print_time_min?: number
    assembly_time_min?: number
    packaging_cost?: number
    platform_fee_pct?: number
    table_fee?: number
    selling_venue?: string
    event_date?: string
    notes?: string
    saved_project_id?: string
  }
  const body = await c.req.json<Body>()
  if (!body.name) return err(c, 'name is required')

  const [settings] = await db
    .select()
    .from(userQuoteSettings)
    .where(eq(userQuoteSettings.user_id, userId))

  const [created] = await db
    .insert(quoteProjects)
    .values({
      user_id: userId,
      name: body.name.trim(),
      batch_quantity: body.batch_quantity ?? 1,
      print_time_min: body.print_time_min?.toString() ?? null,
      assembly_time_min: body.assembly_time_min?.toString() ?? null,
      packaging_cost: (body.packaging_cost ?? parseFloat(settings?.default_packaging_cost ?? '0')).toString(),
      platform_fee_pct: body.platform_fee_pct?.toString() ?? '0',
      table_fee: body.table_fee?.toString() ?? '0',
      selling_venue: body.selling_venue ?? settings?.default_venue ?? 'other',
      event_date: body.event_date ?? null,
      notes: body.notes?.trim() ?? null,
      saved_project_id: body.saved_project_id ?? null,
    })
    .returning()

  return ok(c, created, 201)
})

// ── Get quote + line items + calculated totals ────────────────

quoteRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [quote] = await db
    .select()
    .from(quoteProjects)
    .where(and(eq(quoteProjects.id, id), eq(quoteProjects.user_id, userId)))

  if (!quote) return err(c, 'Quote not found', 404)

  const lineItems = await db
    .select()
    .from(quoteLineItems)
    .where(eq(quoteLineItems.quote_id, id))
    .orderBy(quoteLineItems.sort_order)

  const [settings] = await db
    .select()
    .from(userQuoteSettings)
    .where(eq(userQuoteSettings.user_id, userId))

  const totals = calculateTotals(lineItems, quote.batch_quantity, settings ?? null)
  const tips = beginnerTips(quote, lineItems, settings ?? null)

  // ── Commercial license check on linked project ──
  let licenseWarning: { license: string; commercial_ok: boolean | null; platform: string } | null = null
  if (quote.saved_project_id) {
    const [linked] = await db
      .select()
      .from(savedProjects)
      .where(eq(savedProjects.id, quote.saved_project_id))

    if (linked?.notes) {
      try {
        const info = JSON.parse(linked.notes)
        if (typeof info.license === 'string' && info.commercial_ok === false) {
          licenseWarning = {
            license: info.license,
            commercial_ok: info.commercial_ok,
            platform: linked.source_platform,
          }
        }
      } catch {
        // notes wasn't license JSON — ignore
      }
    }
  }

  return ok(c, { quote, lineItems, totals, tips, licenseWarning })
})

// ── Update quote ──────────────────────────────────────────────

quoteRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  type Body = Partial<{
    name: string
    batch_quantity: number
    print_time_min: number
    assembly_time_min: number
    packaging_cost: number
    platform_fee_pct: number
    table_fee: number
    selling_venue: string
    target_price: number
    status: string
    event_date: string
    notes: string
  }>
  const body = await c.req.json<Body>()

  const setFields: Record<string, unknown> = {}
  if (body.name             !== undefined) setFields.name             = body.name.trim()
  if (body.batch_quantity   !== undefined) setFields.batch_quantity   = body.batch_quantity
  if (body.print_time_min   !== undefined) setFields.print_time_min   = body.print_time_min?.toString() ?? null
  if (body.assembly_time_min !== undefined) setFields.assembly_time_min = body.assembly_time_min?.toString() ?? null
  if (body.packaging_cost   !== undefined) setFields.packaging_cost   = body.packaging_cost?.toString() ?? null
  if (body.platform_fee_pct !== undefined) setFields.platform_fee_pct = body.platform_fee_pct?.toString() ?? null
  if (body.table_fee        !== undefined) setFields.table_fee        = body.table_fee?.toString() ?? null
  if (body.selling_venue    !== undefined) setFields.selling_venue    = body.selling_venue
  if (body.target_price     !== undefined) setFields.target_price     = body.target_price?.toString() ?? null
  if (body.status           !== undefined) setFields.status           = body.status
  if (body.event_date       !== undefined) setFields.event_date       = body.event_date ?? null
  if (body.notes            !== undefined) setFields.notes            = body.notes?.trim() ?? null

  const [updated] = await db
    .update(quoteProjects)
    .set(setFields)
    .where(and(eq(quoteProjects.id, id), eq(quoteProjects.user_id, userId)))
    .returning()

  if (!updated) return err(c, 'Quote not found', 404)
  return ok(c, updated)
})

// ── Delete quote ──────────────────────────────────────────────

quoteRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  await db.delete(quoteProjects)
    .where(and(eq(quoteProjects.id, id), eq(quoteProjects.user_id, userId)))

  return ok(c, { deleted: true })
})

// ── Add line item ─────────────────────────────────────────────

quoteRoutes.post('/:id/line-items', async (c) => {
  const userId = c.get('userId')
  const quoteId = c.req.param('id')

  const [quote] = await db
    .select()
    .from(quoteProjects)
    .where(and(eq(quoteProjects.id, quoteId), eq(quoteProjects.user_id, userId)))
  if (!quote) return err(c, 'Quote not found', 404)

  type Body = {
    item_type: string
    item_ref_id?: string
    item_ref_type?: string
    description: string
    qty_per_unit?: number
    unit_label?: string
    cost_per_unit_item?: number
    line_cost_per_unit?: number
    is_from_inventory?: boolean
    sort_order?: number
  }
  const body = await c.req.json<Body>()
  if (!body.description) return err(c, 'description is required')
  if (!body.item_type)   return err(c, 'item_type is required')

  const lineCost = body.line_cost_per_unit
    ?? (body.qty_per_unit != null && body.cost_per_unit_item != null
      ? body.qty_per_unit * body.cost_per_unit_item
      : 0)

  const [created] = await db
    .insert(quoteLineItems)
    .values({
      quote_id: quoteId,
      item_type: body.item_type,
      item_ref_id: body.item_ref_id ?? null,
      item_ref_type: body.item_ref_type ?? null,
      description: body.description.trim(),
      qty_per_unit: body.qty_per_unit?.toString() ?? null,
      unit_label: body.unit_label ?? null,
      cost_per_unit_item: body.cost_per_unit_item?.toString() ?? null,
      line_cost_per_unit: lineCost.toString(),
      is_from_inventory: body.is_from_inventory ?? false,
      sort_order: body.sort_order ?? 0,
    })
    .returning()

  return ok(c, created, 201)
})

// ── Update line item ──────────────────────────────────────────

quoteRoutes.patch('/:id/line-items/:lid', async (c) => {
  const quoteId = c.req.param('id')
  const lid = c.req.param('lid')
  type Body = Partial<{
    description: string
    qty_per_unit: number
    unit_label: string
    cost_per_unit_item: number
    line_cost_per_unit: number
    sort_order: number
  }>
  const body = await c.req.json<Body>()

  const setFields: Record<string, unknown> = {}
  if (body.description !== undefined) setFields.description = body.description.trim()
  if (body.unit_label  !== undefined) setFields.unit_label  = body.unit_label
  if (body.sort_order  !== undefined) setFields.sort_order  = body.sort_order

  // Recalculate line cost if qty or rate changes
  if (body.qty_per_unit !== undefined) setFields.qty_per_unit = body.qty_per_unit.toString()
  if (body.cost_per_unit_item !== undefined) setFields.cost_per_unit_item = body.cost_per_unit_item.toString()
  if (body.line_cost_per_unit !== undefined) setFields.line_cost_per_unit = body.line_cost_per_unit.toString()
  else if (body.qty_per_unit != null && body.cost_per_unit_item != null) {
    setFields.line_cost_per_unit = (body.qty_per_unit * body.cost_per_unit_item).toString()
  }

  const [updated] = await db
    .update(quoteLineItems)
    .set(setFields)
    .where(and(eq(quoteLineItems.id, lid), eq(quoteLineItems.quote_id, quoteId)))
    .returning()

  if (!updated) return err(c, 'Line item not found', 404)
  return ok(c, updated)
})

// ── Delete line item ──────────────────────────────────────────

quoteRoutes.delete('/:id/line-items/:lid', async (c) => {
  const quoteId = c.req.param('id')
  const lid = c.req.param('lid')

  await db.delete(quoteLineItems).where(
    and(eq(quoteLineItems.id, lid), eq(quoteLineItems.quote_id, quoteId))
  )

  return ok(c, { deleted: true })
})

// ── Inventory check ───────────────────────────────────────────

quoteRoutes.get('/:id/inventory-check', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [quote] = await db
    .select()
    .from(quoteProjects)
    .where(and(eq(quoteProjects.id, id), eq(quoteProjects.user_id, userId)))
  if (!quote) return err(c, 'Quote not found', 404)

  const lineItems = await db
    .select()
    .from(quoteLineItems)
    .where(eq(quoteLineItems.quote_id, id))

  const shortfalls: Array<{
    description: string
    required: number
    available: number
    gap: number
    unit: string
    status: 'ok' | 'insufficient'
  }> = []

  let canFulfill = true

  for (const li of lineItems) {
    if (!li.is_from_inventory || !li.item_ref_id) continue

    const needed = parseFloat(li.qty_per_unit ?? '0') * quote.batch_quantity

    if (li.item_ref_type === 'spool') {
      const [spool] = await db
        .select({ current_gross_weight_g: spools.current_gross_weight_g })
        .from(spools)
        .where(eq(spools.id, li.item_ref_id))

      const available = parseFloat(spool?.current_gross_weight_g ?? '0')
      if (available < needed) {
        canFulfill = false
        shortfalls.push({
          description: li.description,
          required: needed,
          available,
          gap: needed - available,
          unit: 'g',
          status: 'insufficient',
        })
      } else {
        shortfalls.push({ description: li.description, required: needed, available, gap: 0, unit: 'g', status: 'ok' })
      }

    } else if (li.item_ref_type === 'workshop_item') {
      const [item] = await db
        .select({ quantity: workshopItems.quantity, unit: workshopItems.unit })
        .from(workshopItems)
        .where(eq(workshopItems.id, li.item_ref_id))

      const available = parseFloat(item?.quantity ?? '0')
      if (available < needed) {
        canFulfill = false
        shortfalls.push({
          description: li.description,
          required: needed,
          available,
          gap: needed - available,
          unit: item?.unit ?? 'pcs',
          status: 'insufficient',
        })
      } else {
        shortfalls.push({ description: li.description, required: needed, available, gap: 0, unit: item?.unit ?? 'pcs', status: 'ok' })
      }
    }
  }

  return ok(c, { can_fulfill: canFulfill, shortfalls })
})

// ── Complete (post-event logging) ─────────────────────────────

quoteRoutes.post('/:id/complete', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  type Body = { units_sold: number; actual_revenue: number; notes?: string }
  const body = await c.req.json<Body>()

  const [quote] = await db
    .select()
    .from(quoteProjects)
    .where(and(eq(quoteProjects.id, id), eq(quoteProjects.user_id, userId)))
  if (!quote) return err(c, 'Quote not found', 404)

  const lineItems = await db
    .select()
    .from(quoteLineItems)
    .where(eq(quoteLineItems.quote_id, id))

  const [settings] = await db
    .select()
    .from(userQuoteSettings)
    .where(eq(userQuoteSettings.user_id, userId))

  const totals = calculateTotals(lineItems, quote.batch_quantity, settings ?? null)
  const sellThrough = sellThroughAdvice(
    body.units_sold,
    quote.batch_quantity,
    parseFloat(quote.target_price ?? '0'),
    totals.true_cost_per_unit,
  )

  const newStatus = body.units_sold >= quote.batch_quantity
    ? 'sold_out'
    : body.units_sold > 0
    ? 'partial'
    : 'confirmed'

  const [updated] = await db
    .update(quoteProjects)
    .set({
      units_sold: body.units_sold,
      actual_revenue: body.actual_revenue.toString(),
      status: newStatus,
      ...(body.notes ? { notes: body.notes.trim() } : {}),
    })
    .where(eq(quoteProjects.id, id))
    .returning()

  const sellThroughPct = quote.batch_quantity > 0
    ? Math.round((body.units_sold / quote.batch_quantity) * 100)
    : 0

  const actualProfit = body.actual_revenue - totals.total_batch_cost * (body.units_sold / quote.batch_quantity)

  return ok(c, {
    quote: updated,
    sell_through_pct: sellThroughPct,
    actual_profit: Math.round(actualProfit * 100) / 100,
    advice: sellThrough,
  })
})

export default quoteRoutes
