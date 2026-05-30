import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import {
  printKits,
  kitComponents,
  workshopItems,
  filamentProfiles,
  spools,
} from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'
import { sql } from 'drizzle-orm'

const kitRoutes = new Hono()
kitRoutes.use('*', requireAuth)

// ── List kits ─────────────────────────────────────────────────

kitRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const kits = await db
    .select()
    .from(printKits)
    .where(eq(printKits.user_id, userId))
    .orderBy(printKits.created_at)
  return ok(c, kits)
})

// ── Get kit with components and readiness ─────────────────────

kitRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [kit] = await db
    .select()
    .from(printKits)
    .where(and(eq(printKits.id, id), eq(printKits.user_id, userId)))

  if (!kit) return err(c, 'Kit not found', 404)

  const components = await db
    .select({
      component: kitComponents,
      workshop_name: workshopItems.name,
      workshop_qty: workshopItems.quantity,
      workshop_unit: workshopItems.unit,
      filament_brand: filamentProfiles.brand,
      filament_material: filamentProfiles.material,
      filament_color: filamentProfiles.color_hex,
    })
    .from(kitComponents)
    .leftJoin(workshopItems, eq(kitComponents.workshop_item_id, workshopItems.id))
    .leftJoin(filamentProfiles, eq(kitComponents.filament_profile_id, filamentProfiles.id))
    .where(eq(kitComponents.kit_id, id))

  const readiness = await checkReadiness(id, components)

  return ok(c, { kit, components, readiness })
})

// ── Create kit ────────────────────────────────────────────────

kitRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  type Body = {
    name: string
    brand?: string
    kits_owned?: number
    project_url?: string
    notes?: string
  }
  const body = await c.req.json<Body>()
  if (!body.name) return err(c, 'name is required')

  const [created] = await db
    .insert(printKits)
    .values({
      user_id: userId,
      name: body.name.trim(),
      brand: body.brand?.trim() ?? null,
      kits_owned: body.kits_owned ?? 0,
      project_url: body.project_url?.trim() ?? null,
      notes: body.notes?.trim() ?? null,
    })
    .returning()

  return ok(c, created, 201)
})

// ── Update kit ────────────────────────────────────────────────

kitRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  type Body = Partial<{ name: string; brand: string; kits_owned: number; project_url: string; notes: string }>
  const body = await c.req.json<Body>()

  const [updated] = await db
    .update(printKits)
    .set({
      ...(body.name       !== undefined && { name: body.name.trim() }),
      ...(body.brand      !== undefined && { brand: body.brand?.trim() ?? null }),
      ...(body.kits_owned !== undefined && { kits_owned: body.kits_owned }),
      ...(body.project_url !== undefined && { project_url: body.project_url?.trim() ?? null }),
      ...(body.notes      !== undefined && { notes: body.notes?.trim() ?? null }),
    })
    .where(and(eq(printKits.id, id), eq(printKits.user_id, userId)))
    .returning()

  if (!updated) return err(c, 'Kit not found', 404)
  return ok(c, updated)
})

// ── Delete kit ────────────────────────────────────────────────

kitRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  await db
    .delete(printKits)
    .where(and(eq(printKits.id, id), eq(printKits.user_id, userId)))

  return ok(c, { deleted: true })
})

// ── Add component ─────────────────────────────────────────────

kitRoutes.post('/:id/components', async (c) => {
  const userId = c.get('userId')
  const kitId = c.req.param('id')

  const [kit] = await db
    .select()
    .from(printKits)
    .where(and(eq(printKits.id, kitId), eq(printKits.user_id, userId)))
  if (!kit) return err(c, 'Kit not found', 404)

  type Body = {
    component_type: string
    workshop_item_id?: string
    filament_profile_id?: string
    quantity_per_build: number
    filament_grams_per_build?: number
    external_name?: string
    external_buy_url?: string
    notes?: string
  }
  const body = await c.req.json<Body>()
  if (!body.component_type) return err(c, 'component_type is required')
  if (!body.quantity_per_build) return err(c, 'quantity_per_build is required')

  const [created] = await db
    .insert(kitComponents)
    .values({
      kit_id: kitId,
      component_type: body.component_type,
      workshop_item_id: body.workshop_item_id ?? null,
      filament_profile_id: body.filament_profile_id ?? null,
      quantity_per_build: body.quantity_per_build.toString(),
      filament_grams_per_build: body.filament_grams_per_build?.toString() ?? null,
      external_name: body.external_name?.trim() ?? null,
      external_buy_url: body.external_buy_url?.trim() ?? null,
      notes: body.notes?.trim() ?? null,
    })
    .returning()

  return ok(c, created, 201)
})

// ── Update component ──────────────────────────────────────────

kitRoutes.patch('/:id/components/:cid', async (c) => {
  const userId = c.get('userId')
  const kitId = c.req.param('id')
  const cid = c.req.param('cid')

  const [kit] = await db
    .select()
    .from(printKits)
    .where(and(eq(printKits.id, kitId), eq(printKits.user_id, userId)))
  if (!kit) return err(c, 'Kit not found', 404)

  type Body = Partial<{
    quantity_per_build: number
    filament_grams_per_build: number
    external_name: string
    external_buy_url: string
    notes: string
  }>
  const body = await c.req.json<Body>()

  const [updated] = await db
    .update(kitComponents)
    .set({
      ...(body.quantity_per_build !== undefined && { quantity_per_build: body.quantity_per_build.toString() }),
      ...(body.filament_grams_per_build !== undefined && { filament_grams_per_build: body.filament_grams_per_build?.toString() ?? null }),
      ...(body.external_name !== undefined && { external_name: body.external_name?.trim() ?? null }),
      ...(body.external_buy_url !== undefined && { external_buy_url: body.external_buy_url?.trim() ?? null }),
      ...(body.notes !== undefined && { notes: body.notes?.trim() ?? null }),
    })
    .where(eq(kitComponents.id, cid))
    .returning()

  if (!updated) return err(c, 'Component not found', 404)
  return ok(c, updated)
})

// ── Delete component ──────────────────────────────────────────

kitRoutes.delete('/:id/components/:cid', async (c) => {
  const kitId = c.req.param('id')
  const cid = c.req.param('cid')

  await db.delete(kitComponents).where(
    and(eq(kitComponents.id, cid), eq(kitComponents.kit_id, kitId))
  )

  return ok(c, { deleted: true })
})

// ── Readiness check ───────────────────────────────────────────

kitRoutes.get('/:id/readiness', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [kit] = await db
    .select()
    .from(printKits)
    .where(and(eq(printKits.id, id), eq(printKits.user_id, userId)))
  if (!kit) return err(c, 'Kit not found', 404)

  const components = await db
    .select({
      component: kitComponents,
      workshop_name: workshopItems.name,
      workshop_qty: workshopItems.quantity,
      workshop_unit: workshopItems.unit,
      filament_brand: filamentProfiles.brand,
      filament_material: filamentProfiles.material,
      filament_color: filamentProfiles.color_hex,
    })
    .from(kitComponents)
    .leftJoin(workshopItems, eq(kitComponents.workshop_item_id, workshopItems.id))
    .leftJoin(filamentProfiles, eq(kitComponents.filament_profile_id, filamentProfiles.id))
    .where(eq(kitComponents.kit_id, id))

  const readiness = await checkReadiness(id, components)
  return ok(c, readiness)
})

// ── Build kit — deducts components ───────────────────────────

kitRoutes.post('/:id/build', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [kit] = await db
    .select()
    .from(printKits)
    .where(and(eq(printKits.id, id), eq(printKits.user_id, userId)))
  if (!kit) return err(c, 'Kit not found', 404)

  type Body = { action: 'start' | 'complete' }
  const body = await c.req.json<Body>().catch(() => ({ action: 'start' as const }))

  const components = await db
    .select({
      component: kitComponents,
      workshop_qty: workshopItems.quantity,
    })
    .from(kitComponents)
    .leftJoin(workshopItems, eq(kitComponents.workshop_item_id, workshopItems.id))
    .where(eq(kitComponents.kit_id, id))

  if (body.action === 'start') {
    // Deduct workshop items from stock
    for (const row of components) {
      const comp = row.component
      if (comp.component_type === 'workshop_item' && comp.workshop_item_id) {
        const needed = parseFloat(comp.quantity_per_build)
        const current = parseFloat(row.workshop_qty ?? '0')
        const newQty = Math.max(0, current - needed)
        await db
          .update(workshopItems)
          .set({ quantity: newQty.toString() })
          .where(eq(workshopItems.id, comp.workshop_item_id))
      }
    }

    // Increment kits_in_progress
    await db
      .update(printKits)
      .set({ kits_in_progress: (kit.kits_in_progress ?? 0) + 1 })
      .where(eq(printKits.id, id))

  } else if (body.action === 'complete') {
    // Complete: decrement in_progress, increment completed
    const newInProgress = Math.max(0, (kit.kits_in_progress ?? 0) - 1)
    await db
      .update(printKits)
      .set({
        kits_in_progress: newInProgress,
        kits_completed: (kit.kits_completed ?? 0) + 1,
      })
      .where(eq(printKits.id, id))
  }

  const [updated] = await db.select().from(printKits).where(eq(printKits.id, id))
  return ok(c, updated)
})

// ── Helper: readiness check ───────────────────────────────────

async function checkReadiness(
  kitId: string,
  components: Array<{
    component: typeof kitComponents.$inferSelect
    workshop_name: string | null
    workshop_qty: string | null
    workshop_unit: string | null
    filament_brand: string | null
    filament_material: string | null
    filament_color: string | null
  }>
) {
  const missing: Array<{ name: string; needed: number; have: number; unit: string }> = []
  let can_build = true

  for (const row of components) {
    const comp = row.component
    if (comp.component_type === 'workshop_item' && comp.workshop_item_id) {
      const needed = parseFloat(comp.quantity_per_build)
      const have = parseFloat(row.workshop_qty ?? '0')
      if (have < needed) {
        can_build = false
        missing.push({
          name: row.workshop_name ?? comp.external_name ?? 'Unknown',
          needed,
          have,
          unit: row.workshop_unit ?? 'pcs',
        })
      }
    } else if (comp.component_type === 'filament' && comp.filament_profile_id) {
      // Check filament by looking at active spools for that profile
      const spoolRows = await db
        .select({ current_gross_weight_g: spools.current_gross_weight_g })
        .from(spools)
        .where(
          and(
            eq(spools.profile_id, comp.filament_profile_id),
            eq(spools.status, 'active')
          )
        )

      const totalG = spoolRows.reduce((sum, s) => {
        return sum + parseFloat(s.current_gross_weight_g ?? '0')
      }, 0)

      const neededG = parseFloat(comp.filament_grams_per_build ?? '0')
      if (neededG > 0 && totalG < neededG) {
        can_build = false
        missing.push({
          name: `${row.filament_brand ?? ''} ${row.filament_material ?? ''} filament`,
          needed: neededG,
          have: totalG,
          unit: 'g',
        })
      }
    } else if (comp.component_type === 'external') {
      // External components always flagged as unknown
    }
  }

  return { can_build, missing }
}

export default kitRoutes
