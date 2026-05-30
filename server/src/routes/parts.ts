import { Hono } from 'hono'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/client'
import { printerItems, installedItems, printers } from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'
import { evaluateAlerts } from '../lib/alerts'

const partsRoutes = new Hono()
partsRoutes.use('*', requireAuth)

// ── Common parts seed per brand/model ─────────────────────────

const COMMON_PARTS: Record<string, { category: string; name: string; spec?: object }[]> = {
  'Bambu Lab X1 Carbon': [
    { category: 'nozzle', name: 'Hardened nozzle 0.4mm', spec: { diameter: 0.4, material: 'hardened_steel' } },
    { category: 'nozzle', name: 'Brass nozzle 0.4mm',    spec: { diameter: 0.4, material: 'brass' } },
    { category: 'build_plate', name: 'Textured PEI plate' },
    { category: 'build_plate', name: 'Smooth PEI plate' },
    { category: 'tube', name: 'PTFE tube AMS' },
  ],
  'Bambu Lab P1S': [
    { category: 'nozzle', name: 'Hardened nozzle 0.4mm', spec: { diameter: 0.4, material: 'hardened_steel' } },
    { category: 'nozzle', name: 'Brass nozzle 0.4mm',    spec: { diameter: 0.4, material: 'brass' } },
    { category: 'build_plate', name: 'Textured PEI plate' },
    { category: 'build_plate', name: 'Smooth PEI plate' },
    { category: 'tube', name: 'PTFE tube AMS' },
  ],
  'Bambu Lab A1': [
    { category: 'nozzle', name: 'Brass nozzle 0.4mm', spec: { diameter: 0.4, material: 'brass' } },
    { category: 'build_plate', name: 'Textured PEI plate' },
    { category: 'tube', name: 'PTFE tube IFS' },
  ],
  'Bambu Lab A1 Mini': [
    { category: 'nozzle', name: 'Brass nozzle 0.4mm', spec: { diameter: 0.4, material: 'brass' } },
    { category: 'build_plate', name: 'Textured PEI plate' },
    { category: 'tube', name: 'PTFE tube IFS' },
  ],
  'Flashforge AD5X': [
    { category: 'nozzle', name: 'Brass nozzle 0.4mm', spec: { diameter: 0.4, material: 'brass' } },
    { category: 'build_plate', name: 'Flexible PEI plate' },
    { category: 'consumable', name: 'IFS cutter blade' },
  ],
}

function getCommonParts(brand: string, model: string) {
  const key = `${brand} ${model}`
  return COMMON_PARTS[key] ?? [
    { category: 'nozzle', name: 'Brass nozzle 0.4mm', spec: { diameter: 0.4, material: 'brass' } },
    { category: 'build_plate', name: 'Build plate' },
    { category: 'tube', name: 'PTFE tube' },
  ]
}

// ── Routes ────────────────────────────────────────────────────

partsRoutes.get('/:printerId/items', async (c) => {
  const userId = c.get('userId')
  const printerId = c.req.param('printerId')

  const items = await db
    .select()
    .from(printerItems)
    .where(and(eq(printerItems.printer_id, printerId), eq(printerItems.user_id, userId)))
    .orderBy(asc(printerItems.category), asc(printerItems.name))

  return ok(c, items)
})

partsRoutes.post('/:printerId/items', async (c) => {
  const userId = c.get('userId')
  const printerId = c.req.param('printerId')

  const [printer] = await db
    .select({ id: printers.id })
    .from(printers)
    .where(and(eq(printers.id, printerId), eq(printers.user_id, userId)))
    .limit(1)

  if (!printer) return err(c, 'Printer not found', 404)

  type Body = {
    category: string
    name: string
    brand?: string
    spec?: object
    quantity_in_stock?: number
    low_stock_threshold?: number
    reorder_url?: string
    storage_location?: string
    notes?: string
  }

  const body = await c.req.json<Body>()
  if (!body.category) return err(c, 'category is required')
  if (!body.name)     return err(c, 'name is required')

  const [created] = await db
    .insert(printerItems)
    .values({
      user_id:            userId,
      printer_id:         printerId,
      category:           body.category,
      name:               body.name.trim(),
      brand:              body.brand?.trim() ?? null,
      spec:               body.spec ?? null,
      quantity_in_stock:  body.quantity_in_stock ?? 0,
      low_stock_threshold: body.low_stock_threshold ?? 1,
      reorder_url:        body.reorder_url?.trim() ?? null,
      storage_location:   body.storage_location?.trim() ?? null,
      notes:              body.notes?.trim() ?? null,
    })
    .returning()

  evaluateAlerts(userId).catch((e) => console.error('[alerts]', e))
  return ok(c, created, 201)
})

partsRoutes.patch('/:printerId/items/:itemId', async (c) => {
  const userId  = c.get('userId')
  const itemId  = c.req.param('itemId')

  const body = await c.req.json<Record<string, unknown>>()

  const updates: Record<string, unknown> = {}
  const allowed = ['quantity_in_stock', 'low_stock_threshold', 'name', 'brand', 'spec',
    'reorder_url', 'storage_location', 'notes', 'category']
  for (const f of allowed) {
    if (f in body) updates[f] = body[f] ?? null
  }

  if (Object.keys(updates).length === 0) return err(c, 'No valid fields')

  const [updated] = await db
    .update(printerItems)
    .set(updates)
    .where(and(eq(printerItems.id, itemId), eq(printerItems.user_id, userId)))
    .returning()

  if (!updated) return err(c, 'Item not found', 404)
  evaluateAlerts(userId).catch((e) => console.error('[alerts]', e))
  return ok(c, updated)
})

partsRoutes.delete('/:printerId/items/:itemId', async (c) => {
  const userId = c.get('userId')
  const itemId = c.req.param('itemId')

  const deleted = await db
    .delete(printerItems)
    .where(and(eq(printerItems.id, itemId), eq(printerItems.user_id, userId)))
    .returning({ id: printerItems.id })

  if (deleted.length === 0) return err(c, 'Item not found', 404)
  return ok(c, { deleted: true })
})

/** POST /:printerId/items/:itemId/install — mark part as installed */
partsRoutes.post('/:printerId/items/:itemId/install', async (c) => {
  const userId    = c.get('userId')
  const printerId = c.req.param('printerId')
  const itemId    = c.req.param('itemId')

  type InstallBody = {
    installed_date?: string
    replacement_interval_hrs?: number
  }

  const body = await c.req.json<InstallBody>()

  // Mark all previous installed items for this printer+part as not current
  await db
    .update(installedItems)
    .set({ is_current: false })
    .where(
      and(
        eq(installedItems.printer_id, printerId),
        eq(installedItems.printer_item_id, itemId),
        eq(installedItems.is_current, true),
      ),
    )

  // Reduce stock by 1
  const [item] = await db
    .select({ qty: printerItems.quantity_in_stock })
    .from(printerItems)
    .where(eq(printerItems.id, itemId))
    .limit(1)

  if (item && (item.qty ?? 0) > 0) {
    await db
      .update(printerItems)
      .set({ quantity_in_stock: (item.qty ?? 1) - 1 })
      .where(eq(printerItems.id, itemId))
  }

  const [installed] = await db
    .insert(installedItems)
    .values({
      user_id:                  userId,
      printer_id:               printerId,
      printer_item_id:          itemId,
      installed_date:           body.installed_date ?? new Date().toISOString().split('T')[0],
      hours_on_part:            '0',
      replacement_interval_hrs: body.replacement_interval_hrs?.toString() ?? null,
      is_current:               true,
    })
    .returning()

  evaluateAlerts(userId).catch((e) => console.error('[alerts]', e))
  return ok(c, installed, 201)
})

/** POST /:printerId/seed-parts — auto-populate common parts for a known model */
partsRoutes.post('/:printerId/seed-parts', async (c) => {
  const userId    = c.get('userId')
  const printerId = c.req.param('printerId')

  const [printer] = await db
    .select({ brand: printers.brand, model: printers.model })
    .from(printers)
    .where(and(eq(printers.id, printerId), eq(printers.user_id, userId)))
    .limit(1)

  if (!printer) return err(c, 'Printer not found', 404)

  const parts = getCommonParts(printer.brand, printer.model)

  const created = await db
    .insert(printerItems)
    .values(parts.map((p) => ({
      user_id:             userId,
      printer_id:          printerId,
      category:            p.category,
      name:                p.name,
      spec:                p.spec ?? null,
      quantity_in_stock:   0,
      low_stock_threshold: 1,
    })))
    .returning()

  return ok(c, created, 201)
})

export default partsRoutes
