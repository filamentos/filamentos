import { Hono } from 'hono'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { db } from '../db/client'
import {
  filamentProfiles,
  spools,
  weightLogs,
  purchaseRecords,
} from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'
import { evaluateAlerts } from '../lib/alerts'

const filament = new Hono()

// All routes require a valid session
filament.use('*', requireAuth)

// ── Helpers ───────────────────────────────────────────────────

/**
 * Compute filament_remaining_g for a spool row already joined with its profile.
 * Returns null when either weight is unknown.
 */
function computeRemaining(
  current_gross_weight_g: string | null,
  empty_spool_weight_g: string | null,
): number | null {
  if (current_gross_weight_g == null || empty_spool_weight_g == null) return null
  const remaining = parseFloat(current_gross_weight_g) - parseFloat(empty_spool_weight_g)
  return Math.max(0, remaining)
}

/**
 * Compute remaining % (0–100). Returns null when inputs are missing.
 */
function computeRemainingPct(
  remaining_g: number | null,
  net_spool_weight_g: string | null,
): number | null {
  if (remaining_g == null || net_spool_weight_g == null) return null
  const net = parseFloat(net_spool_weight_g)
  if (net <= 0) return null
  return Math.min(100, Math.max(0, (remaining_g / net) * 100))
}

// ── Profile routes ────────────────────────────────────────────

/**
 * GET /api/filament/profiles
 * Returns all profiles for the authenticated user with per-status spool counts.
 */
filament.get('/profiles', async (c) => {
  const userId = c.get('userId')

  const profiles = await db
    .select()
    .from(filamentProfiles)
    .where(eq(filamentProfiles.user_id, userId))
    .orderBy(asc(filamentProfiles.brand), asc(filamentProfiles.material))

  if (profiles.length === 0) return ok(c, [])

  // Fetch all spools for these profiles in a single query, then group in JS
  const profileIds = profiles.map((p) => p.id)

  const allSpools = await db
    .select({
      profile_id: spools.profile_id,
      status: spools.status,
      current_gross_weight_g: spools.current_gross_weight_g,
    })
    .from(spools)
    .where(
      and(
        eq(spools.user_id, userId),
        sql`${spools.profile_id} = ANY(${sql.raw(`ARRAY['${profileIds.join("','")}'::uuid]`)})`,
      ),
    )

  // Group counts by profile_id
  const counts: Record<
    string,
    { active: number; reserve: number; partial_reserve: number; ordered: number; total: number }
  > = {}

  for (const spool of allSpools) {
    if (!counts[spool.profile_id]) {
      counts[spool.profile_id] = { active: 0, reserve: 0, partial_reserve: 0, ordered: 0, total: 0 }
    }
    counts[spool.profile_id].total++
    if (spool.status === 'active') counts[spool.profile_id].active++
    else if (spool.status === 'reserve') counts[spool.profile_id].reserve++
    else if (spool.status === 'partial_reserve') counts[spool.profile_id].partial_reserve++
    else if (spool.status === 'ordered') counts[spool.profile_id].ordered++
  }

  const result = profiles.map((p) => ({
    ...p,
    spool_counts: counts[p.id] ?? { active: 0, reserve: 0, partial_reserve: 0, ordered: 0, total: 0 },
  }))

  return ok(c, result)
})

/**
 * GET /api/filament/profiles/:id
 * Returns a single profile with all its spools (each with filament_remaining_g).
 */
filament.get('/profiles/:id', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.param('id')

  const [profile] = await db
    .select()
    .from(filamentProfiles)
    .where(and(eq(filamentProfiles.id, profileId), eq(filamentProfiles.user_id, userId)))
    .limit(1)

  if (!profile) return err(c, 'Profile not found', 404)

  const profileSpools = await db
    .select()
    .from(spools)
    .where(and(eq(spools.profile_id, profileId), eq(spools.user_id, userId)))
    .orderBy(asc(spools.status), asc(spools.purchase_date))

  const spoolsWithRemaining = profileSpools.map((s) => {
    const remaining = computeRemaining(s.current_gross_weight_g, profile.empty_spool_weight_g)
    return {
      ...s,
      filament_remaining_g: remaining,
      filament_remaining_pct: computeRemainingPct(remaining, profile.net_spool_weight_g),
    }
  })

  return ok(c, { ...profile, spools: spoolsWithRemaining })
})

/**
 * POST /api/filament/profiles
 * Create a new filament profile.
 */
filament.post('/profiles', async (c) => {
  const userId = c.get('userId')

  type CreateProfileBody = {
    brand: string
    material: string
    material_variant?: string
    color_name?: string
    color_hex?: string
    diameter_mm?: number
    empty_spool_weight_g?: number
    net_spool_weight_g?: number
    cost_per_spool?: number
    currency?: string
    reorder_url?: string
    sku?: string
    alert_mode?: string
    low_gram_threshold_g?: number
    critical_gram_threshold_g?: number
    low_spool_threshold?: number
    alert_on_last_spool?: boolean
    price_target?: number
    notes?: string
  }

  const body = await c.req.json<CreateProfileBody>()

  if (!body.brand?.trim()) return err(c, 'brand is required')
  if (!body.material?.trim()) return err(c, 'material is required')

  const [created] = await db
    .insert(filamentProfiles)
    .values({
      user_id: userId,
      brand: body.brand.trim(),
      material: body.material.trim(),
      material_variant: body.material_variant?.trim() ?? null,
      color_name: body.color_name?.trim() ?? null,
      color_hex: body.color_hex?.trim() ?? null,
      diameter_mm: body.diameter_mm?.toString() ?? '1.75',
      empty_spool_weight_g: body.empty_spool_weight_g?.toString() ?? null,
      net_spool_weight_g: body.net_spool_weight_g?.toString() ?? '1000',
      cost_per_spool: body.cost_per_spool?.toString() ?? null,
      currency: body.currency ?? 'USD',
      reorder_url: body.reorder_url?.trim() ?? null,
      sku: body.sku?.trim() ?? null,
      alert_mode: body.alert_mode ?? 'both',
      low_gram_threshold_g: body.low_gram_threshold_g?.toString() ?? '150',
      critical_gram_threshold_g: body.critical_gram_threshold_g?.toString() ?? '50',
      low_spool_threshold: body.low_spool_threshold ?? 1,
      alert_on_last_spool: body.alert_on_last_spool ?? true,
      price_target: body.price_target?.toString() ?? null,
      notes: body.notes?.trim() ?? null,
    })
    .returning()

  return ok(c, created, 201)
})

/**
 * PATCH /api/filament/profiles/:id
 * Partial update of a profile.
 */
filament.patch('/profiles/:id', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.param('id')

  const [existing] = await db
    .select({ id: filamentProfiles.id })
    .from(filamentProfiles)
    .where(and(eq(filamentProfiles.id, profileId), eq(filamentProfiles.user_id, userId)))
    .limit(1)

  if (!existing) return err(c, 'Profile not found', 404)

  const body = await c.req.json<Record<string, unknown>>()

  // Whitelist editable fields
  const allowed = [
    'brand', 'material', 'material_variant', 'color_name', 'color_hex',
    'diameter_mm', 'empty_spool_weight_g', 'net_spool_weight_g', 'cost_per_spool',
    'currency', 'reorder_url', 'sku', 'alert_mode', 'low_gram_threshold_g',
    'critical_gram_threshold_g', 'low_spool_threshold', 'alert_on_last_spool',
    'price_target', 'notes',
  ] as const

  type AllowedKey = typeof allowed[number]
  const updates: Partial<Record<AllowedKey, unknown>> = {}

  for (const key of allowed) {
    if (key in body) {
      const val = body[key]
      // Convert numeric fields to strings for Drizzle numeric columns
      if (
        [
          'diameter_mm', 'empty_spool_weight_g', 'net_spool_weight_g',
          'cost_per_spool', 'low_gram_threshold_g', 'critical_gram_threshold_g', 'price_target',
        ].includes(key)
      ) {
        updates[key] = val != null ? String(val) : null
      } else {
        updates[key] = val
      }
    }
  }

  if (Object.keys(updates).length === 0) return err(c, 'No valid fields to update')

  const [updated] = await db
    .update(filamentProfiles)
    .set(updates as Parameters<typeof db.update>[0] extends infer _T ? Record<string, unknown> : never)
    .where(and(eq(filamentProfiles.id, profileId), eq(filamentProfiles.user_id, userId)))
    .returning()

  return ok(c, updated)
})

/**
 * DELETE /api/filament/profiles/:id
 * Deletes a profile (cascades to spools and weight logs via FK).
 */
filament.delete('/profiles/:id', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.param('id')

  const deleted = await db
    .delete(filamentProfiles)
    .where(and(eq(filamentProfiles.id, profileId), eq(filamentProfiles.user_id, userId)))
    .returning({ id: filamentProfiles.id })

  if (deleted.length === 0) return err(c, 'Profile not found', 404)

  return ok(c, { deleted: true })
})

// ── Spool routes ──────────────────────────────────────────────

/**
 * GET /api/filament/spools
 * List spools — optionally filtered by ?profile_id=...
 * Each spool includes filament_remaining_g computed from profile.empty_spool_weight_g.
 */
filament.get('/spools', async (c) => {
  const userId = c.get('userId')
  const profileId = c.req.query('profile_id')

  const conditions = [eq(spools.user_id, userId)]
  if (profileId) conditions.push(eq(spools.profile_id, profileId))

  const rows = await db
    .select({
      spool: spools,
      empty_spool_weight_g: filamentProfiles.empty_spool_weight_g,
      net_spool_weight_g:   filamentProfiles.net_spool_weight_g,
    })
    .from(spools)
    .innerJoin(filamentProfiles, eq(spools.profile_id, filamentProfiles.id))
    .where(and(...conditions))
    .orderBy(asc(spools.status), desc(spools.created_at))

  const result = rows.map(({ spool, empty_spool_weight_g, net_spool_weight_g }) => {
    const remaining = computeRemaining(spool.current_gross_weight_g, empty_spool_weight_g)
    return {
      ...spool,
      filament_remaining_g: remaining,
      filament_remaining_pct: computeRemainingPct(remaining, net_spool_weight_g),
    }
  })

  return ok(c, result)
})

/**
 * POST /api/filament/spools
 * Add a spool to a profile.
 */
filament.post('/spools', async (c) => {
  const userId = c.get('userId')

  type CreateSpoolBody = {
    profile_id: string
    status?: string                  // 'ordered' | 'reserve'
    purchase_date?: string
    ordered_date?: string
    received_date?: string
    current_gross_weight_g?: number
    opening_gross_weight_g?: number
    storage_location?: string
    is_in_drybox?: boolean
    lot_number?: string
    purchase_record_id?: string
    notes?: string
    // Inline purchase capture
    price_paid?: number
    source_name?: string
    net_weight_g?: number
  }

  const body = await c.req.json<CreateSpoolBody>()

  if (!body.profile_id) return err(c, 'profile_id is required')

  // Verify profile belongs to user
  const [profile] = await db
    .select()
    .from(filamentProfiles)
    .where(and(eq(filamentProfiles.id, body.profile_id), eq(filamentProfiles.user_id, userId)))
    .limit(1)

  if (!profile) return err(c, 'Profile not found', 404)

  const status = body.status === 'ordered' ? 'ordered' : 'reserve'
  const today = new Date().toISOString().split('T')[0]

  // Optionally create a purchase_record inline when a price was entered
  let purchaseRecordId: string | null = body.purchase_record_id ?? null
  if (purchaseRecordId == null && body.price_paid != null && !isNaN(Number(body.price_paid))) {
    const label = `${profile.brand} ${profile.material}${profile.color_name ? ` ${profile.color_name}` : ''}`.trim()
    const [rec] = await db
      .insert(purchaseRecords)
      .values({
        user_id: userId,
        item_type: 'filament_spool',
        item_ref_id: profile.id,
        purchase_date: body.ordered_date ?? body.purchase_date ?? today,
        quantity: 1,
        price_per_unit: body.price_paid.toString(),
        total_paid: body.price_paid.toString(),
        currency: profile.currency ?? 'USD',
        product_title: label,
        notes: body.source_name ? `Source: ${body.source_name.trim()}` : null,
      })
      .returning()
    purchaseRecordId = rec.id
  }

  const [spool] = await db
    .insert(spools)
    .values({
      user_id: userId,
      profile_id: body.profile_id,
      status,
      purchase_date: body.purchase_date ?? body.ordered_date ?? null,
      ordered_date: body.ordered_date ?? (status === 'ordered' ? today : null),
      received_date: status === 'reserve' ? (body.received_date ?? today) : null,
      current_gross_weight_g: body.current_gross_weight_g?.toString() ?? null,
      opening_gross_weight_g: body.opening_gross_weight_g?.toString() ?? null,
      storage_location: body.storage_location?.trim() ?? null,
      is_in_drybox: body.is_in_drybox ?? false,
      lot_number: body.lot_number?.trim() ?? null,
      purchase_record_id: purchaseRecordId,
      notes: body.notes?.trim() ?? null,
    })
    .returning()

  evaluateAlerts(userId).catch((e) => console.error('[alerts]', e))
  return ok(c, spool, 201)
})

/**
 * POST /api/filament/spools/:id/receive
 * Mark an ordered spool as received → status 'reserve', received_date today.
 * Optionally records the opening gross weight.
 */
filament.post('/spools/:id/receive', async (c) => {
  const userId = c.get('userId')
  const spoolId = c.req.param('id')

  type ReceiveBody = { opening_gross_weight_g?: number }
  const body = await c.req.json<ReceiveBody>().catch(() => ({} as ReceiveBody))

  const [spool] = await db
    .select()
    .from(spools)
    .where(and(eq(spools.id, spoolId), eq(spools.user_id, userId)))
    .limit(1)

  if (!spool) return err(c, 'Spool not found', 404)
  if (spool.status !== 'ordered') return err(c, 'Only ordered spools can be received')

  const today = new Date().toISOString().split('T')[0]
  const opening = body.opening_gross_weight_g != null ? String(body.opening_gross_weight_g) : null

  const [updated] = await db
    .update(spools)
    .set({
      status: 'reserve',
      received_date: today,
      opening_gross_weight_g: opening ?? spool.opening_gross_weight_g,
      current_gross_weight_g: opening ?? spool.current_gross_weight_g,
    })
    .where(eq(spools.id, spoolId))
    .returning()

  evaluateAlerts(userId).catch((e) => console.error('[alerts]', e))
  return ok(c, updated)
})

/**
 * POST /api/filament/spools/:id/promote
 * Manually promote a reserve/partial_reserve spool to active by weighing the
 * BARE spool (packaging removed). The entered weight becomes the spool's
 * opening + current gross weight; status → active, opened_date → today.
 */
filament.post('/spools/:id/promote', async (c) => {
  const userId = c.get('userId')
  const spoolId = c.req.param('id')

  type PromoteBody = { bare_gross_weight_g?: number }
  const body = await c.req.json<PromoteBody>().catch(() => ({} as PromoteBody))

  if (body.bare_gross_weight_g == null || isNaN(Number(body.bare_gross_weight_g)) || body.bare_gross_weight_g < 0) {
    return err(c, 'bare_gross_weight_g is required and must be a non-negative number')
  }

  const [spool] = await db
    .select()
    .from(spools)
    .where(and(eq(spools.id, spoolId), eq(spools.user_id, userId)))
    .limit(1)

  if (!spool) return err(c, 'Spool not found', 404)
  if (spool.status !== 'reserve' && spool.status !== 'partial_reserve') {
    return err(c, 'Only reserve spools can be promoted to active')
  }

  const today = new Date().toISOString().split('T')[0]
  const gross = String(body.bare_gross_weight_g)

  // Log the opening measurement
  await db.insert(weightLogs).values({
    spool_id: spoolId,
    user_id: userId,
    logged_at: new Date(),
    gross_weight_g: gross,
    event_type: 'open',
    notes: 'Bare-spool weigh-in at promote to active',
  })

  const [updated] = await db
    .update(spools)
    .set({
      status: 'active',
      opened_date: today,
      opening_gross_weight_g: gross,
      current_gross_weight_g: gross,
    })
    .where(eq(spools.id, spoolId))
    .returning()

  evaluateAlerts(userId).catch((e) => console.error('[alerts]', e))
  return ok(c, updated)
})

/**
 * POST /api/filament/spools/:id/empty-tare
 * Capture the empty bare-spool weight when a spool is finished. Saves the
 * measurement as a sample on the PROFILE, recomputes empty_spool_weight_g as the
 * average of all samples, and marks the spool empty.
 *
 * Drift guard: if the new measurement differs from the current average by more
 * than 10g and `confirm` is not set, return needs_confirmation without saving.
 */
filament.post('/spools/:id/empty-tare', async (c) => {
  const userId = c.get('userId')
  const spoolId = c.req.param('id')

  type TareBody = { empty_weight_g: number; confirm?: boolean }
  const body = await c.req.json<TareBody>()

  if (body.empty_weight_g == null || isNaN(Number(body.empty_weight_g)) || body.empty_weight_g < 0) {
    return err(c, 'empty_weight_g is required and must be a non-negative number')
  }

  const [spool] = await db
    .select()
    .from(spools)
    .where(and(eq(spools.id, spoolId), eq(spools.user_id, userId)))
    .limit(1)
  if (!spool) return err(c, 'Spool not found', 404)

  const [profile] = await db
    .select()
    .from(filamentProfiles)
    .where(and(eq(filamentProfiles.id, spool.profile_id), eq(filamentProfiles.user_id, userId)))
    .limit(1)
  if (!profile) return err(c, 'Profile not found', 404)

  // Existing samples + current average
  type Sample = { weight_g: number; measured_at: string }
  const samples: Sample[] = Array.isArray(profile.empty_spool_weight_samples)
    ? (profile.empty_spool_weight_samples as Sample[])
    : []
  const currentAvg = samples.length
    ? samples.reduce((s, x) => s + x.weight_g, 0) / samples.length
    : (profile.empty_spool_weight_g != null ? parseFloat(profile.empty_spool_weight_g) : null)

  // Drift guard — only when there is an established average to compare to
  if (currentAvg != null && !body.confirm && Math.abs(body.empty_weight_g - currentAvg) > 10) {
    return ok(c, {
      needs_confirmation: true,
      new_weight_g: body.empty_weight_g,
      current_average_g: Math.round(currentAvg * 10) / 10,
    })
  }

  // Append sample + recompute average
  const nextSamples: Sample[] = [
    ...samples,
    { weight_g: body.empty_weight_g, measured_at: new Date().toISOString() },
  ]
  const newAvg = nextSamples.reduce((s, x) => s + x.weight_g, 0) / nextSamples.length
  const newAvgRounded = Math.round(newAvg * 10) / 10

  await db
    .update(filamentProfiles)
    .set({
      empty_spool_weight_samples: nextSamples,
      empty_spool_weight_g: newAvgRounded.toString(),
    })
    .where(eq(filamentProfiles.id, profile.id))

  // Log the empty-spool tare measurement against the spool
  await db.insert(weightLogs).values({
    spool_id: spoolId,
    user_id: userId,
    logged_at: new Date(),
    gross_weight_g: String(body.empty_weight_g),
    event_type: 'empty_spool_tare',
    notes: 'Empty bare-spool tare',
  })

  // Mark the spool empty
  const today = new Date().toISOString().split('T')[0]
  const [updated] = await db
    .update(spools)
    .set({ status: 'empty', empty_date: today })
    .where(eq(spools.id, spoolId))
    .returning()

  evaluateAlerts(userId).catch((e) => console.error('[alerts]', e))
  return ok(c, {
    spool: updated,
    empty_spool_weight_g: newAvgRounded,
    sample_count: nextSamples.length,
  })
})

/**
 * PATCH /api/filament/spools/:id
 * Update a spool (status, weight, storage, etc.)
 */
filament.patch('/spools/:id', async (c) => {
  const userId = c.get('userId')
  const spoolId = c.req.param('id')

  const [existing] = await db
    .select({ id: spools.id })
    .from(spools)
    .where(and(eq(spools.id, spoolId), eq(spools.user_id, userId)))
    .limit(1)

  if (!existing) return err(c, 'Spool not found', 404)

  const body = await c.req.json<Record<string, unknown>>()

  const numericFields = ['current_gross_weight_g', 'opening_gross_weight_g']
  const textFields = [
    'status', 'purchase_date', 'opened_date', 'empty_date',
    'storage_location', 'lot_number', 'notes',
  ]
  const boolFields = ['is_in_drybox']
  const uuidFields = ['purchase_record_id']

  const updates: Record<string, unknown> = {}

  for (const f of numericFields) {
    if (f in body) updates[f] = body[f] != null ? String(body[f]) : null
  }
  for (const f of [...textFields, ...uuidFields]) {
    if (f in body) updates[f] = body[f] ?? null
  }
  for (const f of boolFields) {
    if (f in body) updates[f] = body[f]
  }

  if (Object.keys(updates).length === 0) return err(c, 'No valid fields to update')

  const [updated] = await db
    .update(spools)
    .set(updates)
    .where(and(eq(spools.id, spoolId), eq(spools.user_id, userId)))
    .returning()

  return ok(c, updated)
})

// ── Weight logging ────────────────────────────────────────────

/**
 * POST /api/filament/spools/:id/weigh
 * Log a gross weight measurement for a spool.
 * Updates spool.current_gross_weight_g and inserts a weight_log entry.
 */
filament.post('/spools/:id/weigh', async (c) => {
  const userId = c.get('userId')
  const spoolId = c.req.param('id')

  type WeighBody = {
    gross_weight_g: number
    event_type?: 'weigh' | 'pre_print' | 'post_print' | 'open' | 'empty' | 'empty_spool_tare'
    slicer_estimate_g?: number
    notes?: string
  }

  const body = await c.req.json<WeighBody>()

  if (body.gross_weight_g == null || isNaN(Number(body.gross_weight_g))) {
    return err(c, 'gross_weight_g is required and must be a number')
  }
  if (body.gross_weight_g < 0) {
    return err(c, 'gross_weight_g cannot be negative')
  }

  const [spool] = await db
    .select({ id: spools.id, status: spools.status })
    .from(spools)
    .where(and(eq(spools.id, spoolId), eq(spools.user_id, userId)))
    .limit(1)

  if (!spool) return err(c, 'Spool not found', 404)

  const eventType = body.event_type ?? 'weigh'
  const grossWeight = String(body.gross_weight_g)
  const now = new Date()

  // Insert weight log entry
  const [log] = await db
    .insert(weightLogs)
    .values({
      spool_id: spoolId,
      user_id: userId,
      logged_at: now,
      gross_weight_g: grossWeight,
      event_type: eventType,
      slicer_estimate_g: body.slicer_estimate_g?.toString() ?? null,
      notes: body.notes?.trim() ?? null,
    })
    .returning()

  // Update spool's current weight
  await db
    .update(spools)
    .set({ current_gross_weight_g: grossWeight })
    .where(eq(spools.id, spoolId))

  // Fire-and-forget — don't block the response on alert evaluation
  evaluateAlerts(userId).catch((e) => console.error('[alerts]', e))

  return ok(c, { log, updated_gross_weight_g: body.gross_weight_g }, 201)
})

/**
 * GET /api/filament/spools/:id/logs
 * Weight log history for a spool (newest first).
 */
filament.get('/spools/:id/logs', async (c) => {
  const userId = c.get('userId')
  const spoolId = c.req.param('id')

  const [spool] = await db
    .select({ id: spools.id })
    .from(spools)
    .where(and(eq(spools.id, spoolId), eq(spools.user_id, userId)))
    .limit(1)

  if (!spool) return err(c, 'Spool not found', 404)

  const logs = await db
    .select()
    .from(weightLogs)
    .where(eq(weightLogs.spool_id, spoolId))
    .orderBy(desc(weightLogs.logged_at))

  return ok(c, logs)
})

// ── Spool swap ────────────────────────────────────────────────

/**
 * POST /api/filament/spools/:id/swap
 * Swap flow:
 *   1. Optionally log a final weight for the current (active) spool.
 *   2. Mark it empty: status='empty', empty_date=now.
 *   3. Find the oldest reserve/partial_reserve spool for the same profile.
 *   4. Promote it: status='active', opened_date=now.
 *   5. Optionally log its opening weight.
 *   6. Return { emptied_spool, promoted_spool } (promoted may be null).
 */
filament.post('/spools/:id/swap', async (c) => {
  const userId = c.get('userId')
  const spoolId = c.req.param('id')

  type SwapBody = {
    /** Final gross weight of the spool being emptied (optional) */
    final_gross_weight_g?: number
    /** Opening gross weight of the next spool (optional) */
    opening_gross_weight_g?: number
  }

  const body = await c.req.json<SwapBody>()

  // Load the spool being swapped out
  const [activeSpool] = await db
    .select()
    .from(spools)
    .where(and(eq(spools.id, spoolId), eq(spools.user_id, userId)))
    .limit(1)

  if (!activeSpool) return err(c, 'Spool not found', 404)
  if (activeSpool.status !== 'active') {
    return err(c, 'Only active spools can be swapped out')
  }

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // 1. Optionally log the final weight
  if (body.final_gross_weight_g != null) {
    await db.insert(weightLogs).values({
      spool_id: spoolId,
      user_id: userId,
      logged_at: now,
      gross_weight_g: String(body.final_gross_weight_g),
      event_type: 'empty',
      notes: 'Logged at spool swap',
    })
  }

  // 2. Mark the active spool as empty
  const [emptiedSpool] = await db
    .update(spools)
    .set({
      status: 'empty',
      empty_date: todayStr,
      current_gross_weight_g:
        body.final_gross_weight_g != null
          ? String(body.final_gross_weight_g)
          : activeSpool.current_gross_weight_g,
    })
    .where(eq(spools.id, spoolId))
    .returning()

  // 3. Find the next reserve spool (oldest purchase_date first)
  const reserveCandidates = await db
    .select()
    .from(spools)
    .where(
      and(
        eq(spools.user_id, userId),
        eq(spools.profile_id, activeSpool.profile_id),
        sql`${spools.status} IN ('reserve', 'partial_reserve')`,
      ),
    )
    .orderBy(asc(spools.purchase_date), asc(spools.created_at))
    .limit(1)

  let promotedSpool = null

  if (reserveCandidates.length > 0) {
    const next = reserveCandidates[0]

    // 5. Optionally log the opening weight of the promoted spool
    if (body.opening_gross_weight_g != null) {
      await db.insert(weightLogs).values({
        spool_id: next.id,
        user_id: userId,
        logged_at: now,
        gross_weight_g: String(body.opening_gross_weight_g),
        event_type: 'open',
        notes: 'Logged at spool swap',
      })
    }

    // 4. Promote to active
    const [promoted] = await db
      .update(spools)
      .set({
        status: 'active',
        opened_date: todayStr,
        current_gross_weight_g:
          body.opening_gross_weight_g != null
            ? String(body.opening_gross_weight_g)
            : next.current_gross_weight_g,
        opening_gross_weight_g:
          body.opening_gross_weight_g != null
            ? String(body.opening_gross_weight_g)
            : next.opening_gross_weight_g,
      })
      .where(eq(spools.id, next.id))
      .returning()

    promotedSpool = promoted
  }

  // Fire-and-forget — re-evaluate after swap since reserve count changed
  evaluateAlerts(userId).catch((e) => console.error('[alerts]', e))

  return ok(c, {
    emptied_spool: emptiedSpool,
    promoted_spool: promotedSpool,
    has_next_reserve: promotedSpool !== null,
  })
})

export default filament
