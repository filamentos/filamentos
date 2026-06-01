import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/client'
import {
  projects,
  projectPlates,
  projectPlateColors,
  projectParts,
  filamentProfiles,
  workshopItems,
  printers,
  purchaseRecords,
  userQuoteSettings,
  spools,
} from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'
import {
  calculateCost,
  calculatePricingTiers,
  sellThroughAdvice,
  type CostInputs,
  type InventoryShortfall,
} from '../lib/projectCost'

const projectRoutes = new Hono()
projectRoutes.use('*', requireAuth)

// ── Helpers ───────────────────────────────────────────────────

type ProjectRow = typeof projects.$inferSelect

function num(v: string | null | undefined): number {
  return v == null ? 0 : parseFloat(v)
}

/** cost per gram for a filament profile = cost_per_spool / net_spool_weight_g */
function costPerGram(profile: typeof filamentProfiles.$inferSelect | undefined): number {
  if (!profile) return 0
  const spool = num(profile.cost_per_spool)
  const net = num(profile.net_spool_weight_g) || 1000
  return net > 0 ? spool / net : 0
}

/** latest unit price paid for a workshop item, from purchase records */
async function partUnitCost(userId: string, workshopItemId: string): Promise<number> {
  const [rec] = await db
    .select({ price_per_unit: purchaseRecords.price_per_unit })
    .from(purchaseRecords)
    .where(
      and(
        eq(purchaseRecords.user_id, userId),
        eq(purchaseRecords.item_type, 'workshop_item'),
        eq(purchaseRecords.item_ref_id, workshopItemId),
      ),
    )
    .orderBy(desc(purchaseRecords.purchase_date))
    .limit(1)
  return num(rec?.price_per_unit)
}

interface PlateColorOut {
  id: string
  color_label: string | null
  filament_profile_id: string | null
  grams_used: string
  cost_per_gram: number
  filament_label: string | null
}
interface PlateOut {
  id: string
  plate_number: number
  plate_name: string | null
  colors: PlateColorOut[]
}
interface PartOut {
  id: string
  workshop_item_id: string | null
  quantity_per_unit: string
  cost_per_unit: number
  item_name: string | null
  unit: string | null
  available: number
}

/** Assemble the full project payload: nested data + cost + tiers + inventory + tips */
async function buildProjectDetail(userId: string, project: ProjectRow) {
  // Plates + colors
  const plateRows = await db
    .select()
    .from(projectPlates)
    .where(eq(projectPlates.project_id, project.id))
    .orderBy(projectPlates.plate_number)

  const plates: PlateOut[] = []
  const filamentForCost: CostInputs['filament'] = []
  const filamentShortfalls: InventoryShortfall[] = []
  // accumulate filament needed per profile across plates
  const filamentNeed = new Map<string, { grams: number; label: string }>()

  for (const plate of plateRows) {
    const colorRows = await db
      .select({
        color: projectPlateColors,
        brand: filamentProfiles.brand,
        material: filamentProfiles.material,
        color_name: filamentProfiles.color_name,
        cost_per_spool: filamentProfiles.cost_per_spool,
        net_spool_weight_g: filamentProfiles.net_spool_weight_g,
      })
      .from(projectPlateColors)
      .leftJoin(filamentProfiles, eq(projectPlateColors.filament_profile_id, filamentProfiles.id))
      .where(eq(projectPlateColors.plate_id, plate.id))

    const colors: PlateColorOut[] = colorRows.map((r) => {
      const cpg = costPerGram(
        r.cost_per_spool != null || r.net_spool_weight_g != null
          ? ({ cost_per_spool: r.cost_per_spool, net_spool_weight_g: r.net_spool_weight_g } as typeof filamentProfiles.$inferSelect)
          : undefined,
      )
      const grams = num(r.color.grams_used)
      filamentForCost.push({ grams_used: grams, cost_per_gram: cpg })

      const label = r.brand ? `${r.brand} ${r.material ?? ''}${r.color_name ? ` · ${r.color_name}` : ''}`.trim() : null
      if (r.color.filament_profile_id) {
        const prev = filamentNeed.get(r.color.filament_profile_id) ?? { grams: 0, label: label ?? 'Filament' }
        prev.grams += grams
        filamentNeed.set(r.color.filament_profile_id, prev)
      }
      return {
        id: r.color.id,
        color_label: r.color.color_label,
        filament_profile_id: r.color.filament_profile_id,
        grams_used: r.color.grams_used,
        cost_per_gram: cpg,
        filament_label: label,
      }
    })

    plates.push({
      id: plate.id,
      plate_number: plate.plate_number,
      plate_name: plate.plate_name,
      colors,
    })
  }

  // Parts
  const partRows = await db
    .select({
      part: projectParts,
      item_name: workshopItems.name,
      unit: workshopItems.unit,
      quantity: workshopItems.quantity,
    })
    .from(projectParts)
    .leftJoin(workshopItems, eq(projectParts.workshop_item_id, workshopItems.id))
    .where(eq(projectParts.project_id, project.id))

  const parts: PartOut[] = []
  const partsForCost: CostInputs['parts'] = []
  const partShortfalls: InventoryShortfall[] = []

  for (const r of partRows) {
    const unitCost = r.part.workshop_item_id ? await partUnitCost(userId, r.part.workshop_item_id) : 0
    const qtyPerUnit = num(r.part.quantity_per_unit)
    partsForCost.push({ quantity_per_unit: qtyPerUnit, cost_per_unit: unitCost })

    const available = num(r.quantity)
    const needed = qtyPerUnit * Math.max(1, project.batch_quantity)
    if (r.part.workshop_item_id && needed > available) {
      partShortfalls.push({
        kind: 'part',
        label: r.item_name ?? 'Part',
        needed,
        available,
        gap: needed - available,
        unit: r.unit ?? 'pcs',
      })
    }

    parts.push({
      id: r.part.id,
      workshop_item_id: r.part.workshop_item_id,
      quantity_per_unit: r.part.quantity_per_unit,
      cost_per_unit: unitCost,
      item_name: r.item_name,
      unit: r.unit,
      available,
    })
  }

  // Settings
  const [settings] = await db
    .select()
    .from(userQuoteSettings)
    .where(eq(userQuoteSettings.user_id, userId))

  // Printer wattage — default from settings (no per-printer wattage column yet)
  const wattage = settings?.default_printer_wattage_w ?? 200

  const costInputs: CostInputs = {
    batch_quantity: project.batch_quantity,
    time_mode: project.time_mode as 'per_unit' | 'per_plate',
    print_time_min_per_unit: project.print_time_min_per_unit != null ? num(project.print_time_min_per_unit) : null,
    units_per_plate: project.units_per_plate,
    full_plate_time_min: project.full_plate_time_min != null ? num(project.full_plate_time_min) : null,
    partial_plate_time_min: project.partial_plate_time_min != null ? num(project.partial_plate_time_min) : null,
    assembly_time_min_per_unit: project.assembly_time_min_per_unit != null ? num(project.assembly_time_min_per_unit) : null,
    filament: filamentForCost,
    parts: partsForCost,
    electricity_rate_per_kwh: num(settings?.electricity_rate_per_kwh) || 0.14,
    printer_wattage_w: wattage,
    labor_rate_per_hr: num(settings?.labor_rate_per_hr),
    include_electricity: settings?.include_electricity ?? true,
    include_labor: settings?.include_labor ?? true,
    packaging_cost_per_unit: num(project.packaging_cost_per_unit),
  }

  const cost = calculateCost(costInputs)
  const markup = num(settings?.default_markup) || 3.0
  const tiers = calculatePricingTiers(
    cost.cost_to_print_one,
    project.batch_quantity,
    markup,
    project.target_price != null ? num(project.target_price) : null,
  )

  // Filament shortfalls (needed grams across batch vs active-spool remaining)
  for (const [profileId, need] of filamentNeed) {
    const neededGrams = need.grams * Math.max(1, project.batch_quantity)
    const available = await activeFilamentGrams(profileId)
    if (neededGrams > available) {
      filamentShortfalls.push({
        kind: 'filament',
        label: need.label,
        needed: Math.round(neededGrams * 10) / 10,
        available: Math.round(available * 10) / 10,
        gap: Math.round((neededGrams - available) * 10) / 10,
        unit: 'g',
      })
    }
  }

  const shortfalls = [...filamentShortfalls, ...partShortfalls]

  // Beginner tips
  const tips: string[] = []
  if (num(settings?.labor_rate_per_hr) === 0) {
    tips.push("Your labor rate is $0. Your time has value — even a few minutes of assembly per item adds cost. Set a rate in Settings.")
  }
  if (num(project.table_fee) === 0 && project.venue === 'farmers_market') {
    tips.push("Don't forget the table fee! A $40 table / 20 items = $2 each before you make a cent.")
  }
  const tp = num(project.target_price)
  if (tp > 0 && tp < cost.cost_to_print_one * 2) {
    tips.push(`Your sell price ($${tp.toFixed(2)}) is below 2× cost. You'll cover materials but not your time.`)
  }
  if (project.project_url) {
    tips.push("Check the commercial license on the original design before selling prints — many designers require a paid license.")
  }

  // Printer name
  let printerName: string | null = null
  if (project.printer_id) {
    const [p] = await db.select().from(printers).where(eq(printers.id, project.printer_id))
    if (p) printerName = p.nickname ?? `${p.brand} ${p.model}`
  }

  return {
    project,
    printerName,
    plates,
    parts,
    cost,
    tiers,
    inventory: { can_fulfill: shortfalls.length === 0, shortfalls },
    tips,
  }
}

/** sum of remaining filament grams across active spools of a profile */
async function activeFilamentGrams(profileId: string): Promise<number> {
  const [profile] = await db.select().from(filamentProfiles).where(eq(filamentProfiles.id, profileId))
  const empty = num(profile?.empty_spool_weight_g)
  const rows = await db
    .select({ gross: spools.current_gross_weight_g, status: spools.status })
    .from(spools)
    .where(eq(spools.profile_id, profileId))
  return rows
    .filter((r) => r.status === 'active' || r.status === 'reserve' || r.status === 'partial_reserve')
    .reduce((sum, r) => {
      const gross = num(r.gross)
      return sum + Math.max(0, gross - empty)
    }, 0)
}

// ── List projects (with headline cost per unit) ───────────────

projectRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.user_id, userId))
    .orderBy(desc(projects.created_at))

  // Attach lightweight cost + printer name to each
  const out = []
  for (const project of rows) {
    const detail = await buildProjectDetail(userId, project)
    out.push({
      project,
      printerName: detail.printerName,
      cost_to_print_one: detail.cost.cost_to_print_one,
      suggested_price: detail.tiers.suggested,
      has_selling_info: project.target_price != null || project.units_sold != null,
    })
  }
  return ok(c, out)
})

// ── Get one project (full detail) ─────────────────────────────

projectRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.user_id, userId)))
  if (!project) return err(c, 'Project not found', 404)
  const detail = await buildProjectDetail(userId, project)
  return ok(c, detail)
})

// ── Create project ────────────────────────────────────────────

projectRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json<Record<string, unknown>>()

  // Auto-assign printer if user has exactly one
  let printerId = (body.printer_id as string | undefined) ?? null
  if (!printerId) {
    const userPrinters = await db.select().from(printers).where(eq(printers.user_id, userId))
    if (userPrinters.length === 1) printerId = userPrinters[0].id
  }

  const [created] = await db
    .insert(projects)
    .values({
      user_id: userId,
      project_url: (body.project_url as string)?.trim() || null,
      platform: (body.platform as string) ?? 'other',
      status: (body.status as string) ?? 'want_to_print',
      title: (body.title as string)?.trim() || null,
      designer: (body.designer as string)?.trim() || null,
      printer_id: printerId,
      time_mode: (body.time_mode as string) ?? 'per_unit',
      batch_quantity: (body.batch_quantity as number) ?? 1,
      venue: (body.venue as string) ?? 'other',
    })
    .returning()

  return ok(c, created, 201)
})

// ── Update project ────────────────────────────────────────────

const NUMERIC_FIELDS = new Set([
  'print_time_min_per_unit', 'full_plate_time_min', 'partial_plate_time_min',
  'assembly_time_min_per_unit', 'packaging_cost_per_unit', 'table_fee',
  'platform_fee_pct', 'target_price', 'actual_revenue',
])
const INT_FIELDS = new Set(['batch_quantity', 'units_per_plate', 'units_sold'])
const TEXT_FIELDS = new Set(['project_url', 'platform', 'status', 'title', 'designer', 'time_mode', 'venue', 'notes', 'event_date'])

projectRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json<Record<string, unknown>>()

  const setFields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (key === 'printer_id') {
      setFields.printer_id = value ? value : null
    } else if (NUMERIC_FIELDS.has(key)) {
      setFields[key] = value == null || value === '' ? null : String(value)
    } else if (INT_FIELDS.has(key)) {
      setFields[key] = value == null || value === '' ? null : Math.round(Number(value))
    } else if (TEXT_FIELDS.has(key)) {
      setFields[key] = value == null || value === '' ? null : String(value)
    }
  }

  const [updated] = await db
    .update(projects)
    .set(setFields)
    .where(and(eq(projects.id, id), eq(projects.user_id, userId)))
    .returning()
  if (!updated) return err(c, 'Project not found', 404)
  return ok(c, updated)
})

// ── Delete project ────────────────────────────────────────────

projectRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.user_id, userId)))
  return ok(c, { deleted: true })
})

// ── Ownership guard for nested resources ──────────────────────

async function ownsProject(userId: string, projectId: string): Promise<boolean> {
  const [p] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.user_id, userId)))
  return !!p
}

// ── Plates ────────────────────────────────────────────────────

projectRoutes.post('/:id/plates', async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  if (!(await ownsProject(userId, projectId))) return err(c, 'Project not found', 404)

  const body = await c.req.json<{ plate_number?: number; plate_name?: string }>()
  const existing = await db.select().from(projectPlates).where(eq(projectPlates.project_id, projectId))
  const [created] = await db
    .insert(projectPlates)
    .values({
      project_id: projectId,
      plate_number: body.plate_number ?? existing.length + 1,
      plate_name: body.plate_name?.trim() || null,
    })
    .returning()
  return ok(c, created, 201)
})

projectRoutes.patch('/:id/plates/:plateId', async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  const plateId = c.req.param('plateId')
  if (!(await ownsProject(userId, projectId))) return err(c, 'Project not found', 404)

  const body = await c.req.json<{ plate_name?: string; plate_number?: number }>()
  const [updated] = await db
    .update(projectPlates)
    .set({
      ...(body.plate_name !== undefined && { plate_name: body.plate_name?.trim() || null }),
      ...(body.plate_number !== undefined && { plate_number: body.plate_number }),
    })
    .where(and(eq(projectPlates.id, plateId), eq(projectPlates.project_id, projectId)))
    .returning()
  if (!updated) return err(c, 'Plate not found', 404)
  return ok(c, updated)
})

projectRoutes.delete('/:id/plates/:plateId', async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  const plateId = c.req.param('plateId')
  if (!(await ownsProject(userId, projectId))) return err(c, 'Project not found', 404)
  await db.delete(projectPlates).where(and(eq(projectPlates.id, plateId), eq(projectPlates.project_id, projectId)))
  return ok(c, { deleted: true })
})

// ── Plate colors ──────────────────────────────────────────────

async function ownsPlate(userId: string, plateId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: projectPlates.id })
    .from(projectPlates)
    .innerJoin(projects, eq(projectPlates.project_id, projects.id))
    .where(and(eq(projectPlates.id, plateId), eq(projects.user_id, userId)))
  return !!row
}

projectRoutes.post('/:id/plates/:plateId/colors', async (c) => {
  const userId = c.get('userId')
  const plateId = c.req.param('plateId')
  if (!(await ownsPlate(userId, plateId))) return err(c, 'Plate not found', 404)

  const body = await c.req.json<{ color_label?: string; filament_profile_id?: string; grams_used?: number }>()
  const [created] = await db
    .insert(projectPlateColors)
    .values({
      plate_id: plateId,
      color_label: body.color_label?.trim() || null,
      filament_profile_id: body.filament_profile_id || null,
      grams_used: (body.grams_used ?? 0).toString(),
    })
    .returning()
  return ok(c, created, 201)
})

projectRoutes.patch('/:id/plates/:plateId/colors/:colorId', async (c) => {
  const userId = c.get('userId')
  const plateId = c.req.param('plateId')
  const colorId = c.req.param('colorId')
  if (!(await ownsPlate(userId, plateId))) return err(c, 'Plate not found', 404)

  const body = await c.req.json<{ color_label?: string; filament_profile_id?: string | null; grams_used?: number }>()
  const [updated] = await db
    .update(projectPlateColors)
    .set({
      ...(body.color_label !== undefined && { color_label: body.color_label?.trim() || null }),
      ...(body.filament_profile_id !== undefined && { filament_profile_id: body.filament_profile_id || null }),
      ...(body.grams_used !== undefined && { grams_used: (body.grams_used ?? 0).toString() }),
    })
    .where(and(eq(projectPlateColors.id, colorId), eq(projectPlateColors.plate_id, plateId)))
    .returning()
  if (!updated) return err(c, 'Color not found', 404)
  return ok(c, updated)
})

projectRoutes.delete('/:id/plates/:plateId/colors/:colorId', async (c) => {
  const userId = c.get('userId')
  const plateId = c.req.param('plateId')
  const colorId = c.req.param('colorId')
  if (!(await ownsPlate(userId, plateId))) return err(c, 'Plate not found', 404)
  await db.delete(projectPlateColors).where(and(eq(projectPlateColors.id, colorId), eq(projectPlateColors.plate_id, plateId)))
  return ok(c, { deleted: true })
})

// ── Parts ─────────────────────────────────────────────────────

projectRoutes.post('/:id/parts', async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  if (!(await ownsProject(userId, projectId))) return err(c, 'Project not found', 404)

  const body = await c.req.json<{ workshop_item_id?: string; quantity_per_unit?: number }>()
  const [created] = await db
    .insert(projectParts)
    .values({
      project_id: projectId,
      workshop_item_id: body.workshop_item_id || null,
      quantity_per_unit: (body.quantity_per_unit ?? 1).toString(),
    })
    .returning()
  return ok(c, created, 201)
})

projectRoutes.patch('/:id/parts/:partId', async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  const partId = c.req.param('partId')
  if (!(await ownsProject(userId, projectId))) return err(c, 'Project not found', 404)

  const body = await c.req.json<{ workshop_item_id?: string | null; quantity_per_unit?: number }>()
  const [updated] = await db
    .update(projectParts)
    .set({
      ...(body.workshop_item_id !== undefined && { workshop_item_id: body.workshop_item_id || null }),
      ...(body.quantity_per_unit !== undefined && { quantity_per_unit: (body.quantity_per_unit ?? 1).toString() }),
    })
    .where(and(eq(projectParts.id, partId), eq(projectParts.project_id, projectId)))
    .returning()
  if (!updated) return err(c, 'Part not found', 404)
  return ok(c, updated)
})

projectRoutes.delete('/:id/parts/:partId', async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  const partId = c.req.param('partId')
  if (!(await ownsProject(userId, projectId))) return err(c, 'Project not found', 404)
  await db.delete(projectParts).where(and(eq(projectParts.id, partId), eq(projectParts.project_id, projectId)))
  return ok(c, { deleted: true })
})

// ── Complete (post-event logging) ─────────────────────────────

projectRoutes.post('/:id/complete', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const body = await c.req.json<{ units_sold: number; actual_revenue: number }>()

  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.user_id, userId)))
  if (!project) return err(c, 'Project not found', 404)

  const [updated] = await db
    .update(projects)
    .set({
      units_sold: body.units_sold,
      actual_revenue: body.actual_revenue.toString(),
      status: 'completed',
    })
    .where(eq(projects.id, id))
    .returning()

  const detail = await buildProjectDetail(userId, updated)
  const sellThroughPct = project.batch_quantity > 0
    ? Math.round((body.units_sold / project.batch_quantity) * 100)
    : 0
  const actualProfit = body.actual_revenue - detail.cost.cost_to_print_batch * (body.units_sold / Math.max(1, project.batch_quantity))

  return ok(c, {
    project: updated,
    sell_through_pct: sellThroughPct,
    actual_profit: Math.round(actualProfit * 100) / 100,
    advice: sellThroughAdvice(body.units_sold, project.batch_quantity),
  })
})

export default projectRoutes
