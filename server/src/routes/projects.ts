import { Hono } from 'hono'
import type { Context } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { savedProjects, projectComponents, workshopItems, filamentProfiles, parseUsage } from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'
import { fetchProjectPage } from '../lib/projectParser'
import { extractComponents } from '../lib/componentExtractor'
import { buildBuyLinks } from '../lib/affiliate'

const projectRoutes = new Hono()
projectRoutes.use('*', requireAuth)

// ── List projects ─────────────────────────────────────────────

projectRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const projects = await db
    .select()
    .from(savedProjects)
    .where(eq(savedProjects.user_id, userId))
    .orderBy(savedProjects.created_at)
  return ok(c, projects)
})

// ── Get project with components ───────────────────────────────

projectRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [project] = await db
    .select()
    .from(savedProjects)
    .where(and(eq(savedProjects.id, id), eq(savedProjects.user_id, userId)))

  if (!project) return err(c, 'Project not found', 404)

  const components = await db
    .select({
      component: projectComponents,
      workshop_name: workshopItems.name,
      workshop_qty: workshopItems.quantity,
      filament_brand: filamentProfiles.brand,
      filament_material: filamentProfiles.material,
    })
    .from(projectComponents)
    .leftJoin(workshopItems, eq(projectComponents.inventory_item_id, workshopItems.id))
    .leftJoin(filamentProfiles, eq(projectComponents.inventory_item_id, filamentProfiles.id))
    .where(eq(projectComponents.project_id, id))

  const total = components.length
  const ready = components.filter((r) => r.component.inventory_status === 'have_it').length

  return ok(c, { project, components, readiness: { ready, total } })
})

// ── Create project ────────────────────────────────────────────

projectRoutes.post('/', async (c) => {
  const userId = c.get('userId')
  type Body = {
    source_platform: string
    source_url: string
    project_title?: string
    designer_name?: string
    status?: string
    notes?: string
  }
  const body = await c.req.json<Body>()
  if (!body.source_platform) return err(c, 'source_platform is required')
  if (!body.source_url)      return err(c, 'source_url is required')

  const [created] = await db
    .insert(savedProjects)
    .values({
      user_id: userId,
      source_platform: body.source_platform,
      source_url: body.source_url.trim(),
      project_title: body.project_title?.trim() ?? null,
      designer_name: body.designer_name?.trim() ?? null,
      status: body.status ?? 'want_to_print',
      notes: body.notes?.trim() ?? null,
    })
    .returning()

  return ok(c, created, 201)
})

// ── Update project ────────────────────────────────────────────

projectRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  type Body = Partial<{ project_title: string; designer_name: string; status: string; notes: string }>
  const body = await c.req.json<Body>()

  const [updated] = await db
    .update(savedProjects)
    .set({
      ...(body.project_title !== undefined && { project_title: body.project_title?.trim() ?? null }),
      ...(body.designer_name !== undefined && { designer_name: body.designer_name?.trim() ?? null }),
      ...(body.status        !== undefined && { status: body.status }),
      ...(body.notes         !== undefined && { notes: body.notes?.trim() ?? null }),
    })
    .where(and(eq(savedProjects.id, id), eq(savedProjects.user_id, userId)))
    .returning()

  if (!updated) return err(c, 'Project not found', 404)
  return ok(c, updated)
})

// ── Delete project ────────────────────────────────────────────

projectRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  await db.delete(savedProjects)
    .where(and(eq(savedProjects.id, id), eq(savedProjects.user_id, userId)))

  return ok(c, { deleted: true })
})

// ── Parse project URL (AI component extraction) ───────────────

const DAILY_PARSE_LIMIT = 10

async function runParseFor(c: Context, userId: string, id: string) {
  const [project] = await db
    .select()
    .from(savedProjects)
    .where(and(eq(savedProjects.id, id), eq(savedProjects.user_id, userId)))
  if (!project) return err(c, 'Project not found', 404)

  // ── Rate limit: 10 parses per user per day ──
  const today = new Date().toISOString().split('T')[0]
  const [usage] = await db
    .select()
    .from(parseUsage)
    .where(and(eq(parseUsage.user_id, userId), eq(parseUsage.usage_date, today)))

  if (usage && usage.parse_count >= DAILY_PARSE_LIMIT) {
    return err(c, 'Daily parse limit reached — resets tomorrow.', 429)
  }

  // 1. Fetch the page
  let parsed
  try {
    parsed = await fetchProjectPage(project.source_url)
  } catch (e) {
    return err(c, `Failed to fetch project page: ${(e as Error).message}`)
  }

  // ── Increment parse usage (only counts successful fetches) ──
  if (usage) {
    await db
      .update(parseUsage)
      .set({ parse_count: usage.parse_count + 1 })
      .where(eq(parseUsage.id, usage.id))
  } else {
    await db
      .insert(parseUsage)
      .values({ user_id: userId, usage_date: today, parse_count: 1 })
  }

  // 2. Update project metadata from page
  // Store detected license info in notes as JSON (drives the license badge).
  await db.update(savedProjects).set({
    project_title: project.project_title ?? parsed.title ?? null,
    designer_name: project.designer_name ?? parsed.designer ?? null,
    parsed_at: new Date(),
    raw_description: parsed.description ?? null,
    notes: parsed.licenseText ?? project.notes,
  }).where(eq(savedProjects.id, id))

  // 3. Extract components with Claude
  const extracted = await extractComponents(parsed.fullText)

  // 4. Delete unconfirmed components before reinserting
  await db.delete(projectComponents)
    .where(
      and(
        eq(projectComponents.project_id, id),
        eq(projectComponents.user_confirmed, false),
      )
    )

  // 5. Inventory-match and insert each component
  const userWorkshopItems = await db
    .select()
    .from(workshopItems)
    .where(eq(workshopItems.user_id, userId))

  const userFilamentProfiles = await db
    .select()
    .from(filamentProfiles)
    .where(eq(filamentProfiles.user_id, userId))

  const inserted = []

  for (const comp of extracted) {
    const buyLinks = buildBuyLinks(comp.name, comp.bambu_sku)

    // Attempt inventory match
    let inventoryItemId: string | null = null
    let inventoryItemType: string | null = null
    let inventoryStatus: string = 'missing'

    if (comp.type === 'other' && (
      comp.name.toLowerCase().includes('filament') ||
      comp.name.toLowerCase().includes('pla') ||
      comp.name.toLowerCase().includes('petg') ||
      comp.name.toLowerCase().includes('abs')
    )) {
      // Filament match
      const match = userFilamentProfiles.find((p) =>
        comp.name.toLowerCase().includes(p.material.toLowerCase()) ||
        p.brand.toLowerCase().includes(comp.name.toLowerCase().split(' ')[0] ?? '')
      )
      if (match) {
        inventoryItemId = match.id
        inventoryItemType = 'filament_profile'
        inventoryStatus = 'have_it'
      }
    } else {
      // Workshop item fuzzy match
      const compNameLower = comp.name.toLowerCase()
      const match = userWorkshopItems.find((w) => {
        const wName = w.name.toLowerCase()
        return compNameLower.includes(wName) || wName.includes(compNameLower) ||
          fuzzyMatch(compNameLower, wName)
      })
      if (match) {
        inventoryItemId = match.id
        inventoryItemType = 'workshop_item'
        const qty = parseFloat(match.quantity ?? '0')
        const needed = comp.quantity ?? 1
        inventoryStatus = qty >= needed ? 'have_it' : qty > 0 ? 'low' : 'missing'
      }
    }

    const [row] = await db.insert(projectComponents).values({
      project_id:          id,
      component_name:      comp.name,
      component_type:      comp.type,
      bambu_sku:           comp.bambu_sku ?? null,
      qty_required:        comp.quantity?.toString() ?? null,
      inventory_item_id:   inventoryItemId,
      inventory_item_type: inventoryItemType,
      inventory_status:    inventoryStatus,
      affiliate_amazon_url: buyLinks.amazon,
      affiliate_bambu_url:  buyLinks.bambu ?? null,
      affiliate_ali_url:    buyLinks.aliexpress,
      user_confirmed:      false,
      notes:               comp.notes ?? null,
    }).returning()

    inserted.push(row)
  }

  const [updatedProject] = await db.select().from(savedProjects).where(eq(savedProjects.id, id))

  return ok(c, {
    project: updatedProject,
    components: inserted,
    components_found: inserted.length,
  })
}

// Parse + reparse share the same logic (reparse already replaces unconfirmed components)
projectRoutes.post('/:id/parse',   (c) => runParseFor(c, c.get('userId'), c.req.param('id')))
projectRoutes.post('/:id/reparse', (c) => runParseFor(c, c.get('userId'), c.req.param('id')))

// ── Confirm component ─────────────────────────────────────────

projectRoutes.patch('/:id/components/:cid/confirm', async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  const cid = c.req.param('cid')

  const [project] = await db
    .select()
    .from(savedProjects)
    .where(and(eq(savedProjects.id, projectId), eq(savedProjects.user_id, userId)))
  if (!project) return err(c, 'Project not found', 404)

  const [updated] = await db
    .update(projectComponents)
    .set({ user_confirmed: true })
    .where(and(eq(projectComponents.id, cid), eq(projectComponents.project_id, projectId)))
    .returning()

  if (!updated) return err(c, 'Component not found', 404)
  return ok(c, updated)
})

// ── Update component ──────────────────────────────────────────

projectRoutes.patch('/:id/components/:cid', async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')
  const cid = c.req.param('cid')

  const [project] = await db
    .select()
    .from(savedProjects)
    .where(and(eq(savedProjects.id, projectId), eq(savedProjects.user_id, userId)))
  if (!project) return err(c, 'Project not found', 404)

  type Body = Partial<{
    component_name: string; component_type: string; qty_required: number
    inventory_item_id: string; inventory_item_type: string; inventory_status: string
    user_confirmed: boolean; notes: string
  }>
  const body = await c.req.json<Body>()

  const [updated] = await db
    .update(projectComponents)
    .set({
      ...(body.component_name    !== undefined && { component_name: body.component_name }),
      ...(body.component_type    !== undefined && { component_type: body.component_type ?? null }),
      ...(body.qty_required      !== undefined && { qty_required: body.qty_required?.toString() ?? null }),
      ...(body.inventory_item_id !== undefined && { inventory_item_id: body.inventory_item_id ?? null }),
      ...(body.inventory_item_type !== undefined && { inventory_item_type: body.inventory_item_type ?? null }),
      ...(body.inventory_status  !== undefined && { inventory_status: body.inventory_status ?? null }),
      ...(body.user_confirmed    !== undefined && { user_confirmed: body.user_confirmed }),
      ...(body.notes             !== undefined && { notes: body.notes?.trim() ?? null }),
    })
    .where(and(eq(projectComponents.id, cid), eq(projectComponents.project_id, projectId)))
    .returning()

  if (!updated) return err(c, 'Component not found', 404)
  return ok(c, updated)
})

// ── Add component ─────────────────────────────────────────────

projectRoutes.post('/:id/components', async (c) => {
  const userId = c.get('userId')
  const projectId = c.req.param('id')

  const [project] = await db
    .select()
    .from(savedProjects)
    .where(and(eq(savedProjects.id, projectId), eq(savedProjects.user_id, userId)))
  if (!project) return err(c, 'Project not found', 404)

  type Body = {
    component_name: string; component_type?: string; qty_required?: number
    inventory_item_id?: string; inventory_item_type?: string; inventory_status?: string; notes?: string
  }
  const body = await c.req.json<Body>()
  if (!body.component_name) return err(c, 'component_name is required')

  const [created] = await db
    .insert(projectComponents)
    .values({
      project_id:          projectId,
      component_name:      body.component_name.trim(),
      component_type:      body.component_type ?? null,
      qty_required:        body.qty_required?.toString() ?? null,
      inventory_item_id:   body.inventory_item_id ?? null,
      inventory_item_type: body.inventory_item_type ?? null,
      inventory_status:    body.inventory_status ?? 'missing',
      notes:               body.notes?.trim() ?? null,
    })
    .returning()

  return ok(c, created, 201)
})

// ── Helpers ───────────────────────────────────────────────────

function fuzzyMatch(a: string, b: string): boolean {
  // Word-level overlap: at least one significant word in common
  const stopWords = new Set(['the', 'a', 'an', 'of', 'for', 'with', 'and', 'or', 'to', 'in'])
  const wordsA = a.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w))
  const wordsB = b.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w))
  return wordsA.some((wa) => wordsB.some((wb) => wa.includes(wb) || wb.includes(wa)))
}

export default projectRoutes
