import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { savedProjects, projectComponents, workshopItems, filamentProfiles } from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'

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

  // Derive readiness score
  const total = components.length
  const ready = components.filter(
    (r) => r.component.inventory_status === 'have_it'
  ).length

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

// ── Update project status ─────────────────────────────────────

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

// ── Reparse (Phase 4 stub) ────────────────────────────────────

projectRoutes.post('/:id/reparse', async (c) => {
  return err(c, 'URL parser not yet available — Phase 4 feature')
})

// ── Update component inventory link ──────────────────────────

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
    component_name: string
    component_type: string
    qty_required: number
    inventory_item_id: string
    inventory_item_type: string
    inventory_status: string
    user_confirmed: boolean
    notes: string
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
    component_name: string
    component_type?: string
    qty_required?: number
    inventory_item_id?: string
    inventory_item_type?: string
    inventory_status?: string
    notes?: string
  }
  const body = await c.req.json<Body>()
  if (!body.component_name) return err(c, 'component_name is required')

  const [created] = await db
    .insert(projectComponents)
    .values({
      project_id: projectId,
      component_name: body.component_name.trim(),
      component_type: body.component_type ?? null,
      qty_required: body.qty_required?.toString() ?? null,
      inventory_item_id: body.inventory_item_id ?? null,
      inventory_item_type: body.inventory_item_type ?? null,
      inventory_status: body.inventory_status ?? 'missing',
      notes: body.notes?.trim() ?? null,
    })
    .returning()

  return ok(c, created, 201)
})

export default projectRoutes
