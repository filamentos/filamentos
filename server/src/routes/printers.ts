import { Hono } from 'hono'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '../db/client'
import {
  printers,
  printerAccessories,
  slotAssignments,
  spools,
  filamentProfiles,
} from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'
import { PRINTER_MODELS } from '../lib/printerModels'
import { checkCompatibility } from '../lib/compatibility'

const printerRoutes = new Hono()
printerRoutes.use('*', requireAuth)

// ── Reference data ────────────────────────────────────────────

/** GET /api/printers/models — known model list for typeahead */
printerRoutes.get('/models', (c) => {
  return ok(c, PRINTER_MODELS.map((m) => ({
    brand: m.brand,
    model: m.model,
    label: `${m.brand} ${m.model}`,
  })))
})

// ── Printer CRUD ──────────────────────────────────────────────

printerRoutes.get('/', async (c) => {
  const userId = c.get('userId')

  const rows = await db
    .select()
    .from(printers)
    .where(eq(printers.user_id, userId))
    .orderBy(asc(printers.created_at))

  return ok(c, rows)
})

printerRoutes.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [printer] = await db
    .select()
    .from(printers)
    .where(and(eq(printers.id, id), eq(printers.user_id, userId)))
    .limit(1)

  if (!printer) return err(c, 'Printer not found', 404)

  const accessories = await db
    .select()
    .from(printerAccessories)
    .where(and(eq(printerAccessories.printer_id, id), eq(printerAccessories.user_id, userId)))

  const slots = await db
    .select({
      slot:    slotAssignments,
      spool_status:     spools.status,
      color_hex:        filamentProfiles.color_hex,
      color_name:       filamentProfiles.color_name,
      brand:            filamentProfiles.brand,
      material:         filamentProfiles.material,
    })
    .from(slotAssignments)
    .leftJoin(spools, eq(slotAssignments.spool_id, spools.id))
    .leftJoin(filamentProfiles, eq(slotAssignments.filament_profile_id, filamentProfiles.id))
    .where(and(eq(slotAssignments.printer_id, id), eq(slotAssignments.user_id, userId)))
    .orderBy(asc(slotAssignments.slot_number))

  return ok(c, { ...printer, accessories, slots })
})

printerRoutes.post('/', async (c) => {
  const userId = c.get('userId')

  type CreateBody = {
    brand: string
    model: string
    nickname?: string
    printer_type?: string
    motion_system?: string
    build_volume_x_mm?: number
    build_volume_y_mm?: number
    build_volume_z_mm?: number
    max_nozzle_temp_c?: number
    max_bed_temp_c?: number
    has_enclosure?: boolean
    filament_diameter_mm?: number
    direct_drive?: boolean
    current_nozzle_diameter_mm?: number
    current_nozzle_material?: string
    native_color_slots?: number
    multi_color_system?: string
    purchase_date?: string
    notes?: string
  }

  const body = await c.req.json<CreateBody>()
  if (!body.brand?.trim()) return err(c, 'brand is required')
  if (!body.model?.trim()) return err(c, 'model is required')

  const [created] = await db
    .insert(printers)
    .values({
      user_id:                   userId,
      brand:                     body.brand.trim(),
      model:                     body.model.trim(),
      nickname:                  body.nickname?.trim() ?? null,
      printer_type:              body.printer_type ?? 'FDM',
      motion_system:             body.motion_system ?? null,
      build_volume_x_mm:         body.build_volume_x_mm ?? null,
      build_volume_y_mm:         body.build_volume_y_mm ?? null,
      build_volume_z_mm:         body.build_volume_z_mm ?? null,
      max_nozzle_temp_c:         body.max_nozzle_temp_c ?? null,
      max_bed_temp_c:            body.max_bed_temp_c ?? null,
      has_enclosure:             body.has_enclosure ?? false,
      filament_diameter_mm:      body.filament_diameter_mm?.toString() ?? '1.75',
      direct_drive:              body.direct_drive ?? false,
      current_nozzle_diameter_mm: body.current_nozzle_diameter_mm?.toString() ?? '0.4',
      current_nozzle_material:   body.current_nozzle_material ?? 'brass',
      native_color_slots:        body.native_color_slots ?? 0,
      multi_color_system:        body.multi_color_system ?? null,
      purchase_date:             body.purchase_date ?? null,
      notes:                     body.notes?.trim() ?? null,
    })
    .returning()

  return ok(c, created, 201)
})

printerRoutes.patch('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const [existing] = await db
    .select({ id: printers.id })
    .from(printers)
    .where(and(eq(printers.id, id), eq(printers.user_id, userId)))
    .limit(1)

  if (!existing) return err(c, 'Printer not found', 404)

  const body = await c.req.json<Record<string, unknown>>()

  const numericFields = ['filament_diameter_mm', 'current_nozzle_diameter_mm']
  const allowed = [
    'nickname', 'printer_type', 'motion_system',
    'build_volume_x_mm', 'build_volume_y_mm', 'build_volume_z_mm',
    'max_nozzle_temp_c', 'max_bed_temp_c', 'has_enclosure',
    'filament_diameter_mm', 'direct_drive', 'current_nozzle_diameter_mm',
    'current_nozzle_material', 'native_color_slots', 'multi_color_system',
    'status', 'purchase_date', 'notes',
  ] as const

  const updates: Record<string, unknown> = {}
  for (const f of allowed) {
    if (f in body) {
      updates[f] = numericFields.includes(f) && body[f] != null
        ? String(body[f])
        : body[f] ?? null
    }
  }

  if (Object.keys(updates).length === 0) return err(c, 'No valid fields to update')

  const [updated] = await db
    .update(printers)
    .set(updates)
    .where(and(eq(printers.id, id), eq(printers.user_id, userId)))
    .returning()

  return ok(c, updated)
})

printerRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  const deleted = await db
    .delete(printers)
    .where(and(eq(printers.id, id), eq(printers.user_id, userId)))
    .returning({ id: printers.id })

  if (deleted.length === 0) return err(c, 'Printer not found', 404)
  return ok(c, { deleted: true })
})

// ── Accessories ───────────────────────────────────────────────

printerRoutes.post('/:id/accessories', async (c) => {
  const userId = c.get('userId')
  const printerId = c.req.param('id')

  const [printer] = await db
    .select()
    .from(printers)
    .where(and(eq(printers.id, printerId), eq(printers.user_id, userId)))
    .limit(1)

  if (!printer) return err(c, 'Printer not found', 404)

  type AccBody = {
    accessory_type: string
    brand?: string
    model?: string
    unit_index?: number
    slots_added?: number
    drying_capable?: boolean
    rfid_capable?: boolean
    max_dry_temp_c?: number
    installed_date?: string
    notes?: string
  }

  const body = await c.req.json<AccBody>()
  if (!body.accessory_type) return err(c, 'accessory_type is required')

  // Validate AMS Lite compatibility
  if (body.accessory_type === 'AMS_Lite') {
    const compatibleModels = ['A1', 'A1 Mini']
    if (!compatibleModels.includes(printer.model)) {
      return err(c, `AMS Lite is only compatible with ${compatibleModels.join(', ')}`)
    }
  }

  const [created] = await db
    .insert(printerAccessories)
    .values({
      user_id:        userId,
      printer_id:     printerId,
      accessory_type: body.accessory_type,
      brand:          body.brand?.trim() ?? null,
      model:          body.model?.trim() ?? null,
      unit_index:     body.unit_index ?? 1,
      slots_added:    body.slots_added ?? 0,
      drying_capable: body.drying_capable ?? false,
      rfid_capable:   body.rfid_capable ?? false,
      max_dry_temp_c: body.max_dry_temp_c ?? null,
      installed_date: body.installed_date ?? null,
      notes:          body.notes?.trim() ?? null,
    })
    .returning()

  return ok(c, created, 201)
})

printerRoutes.patch('/:id/accessories/:aid', async (c) => {
  const userId = c.get('userId')
  const aid = c.req.param('aid')

  const body = await c.req.json<Record<string, unknown>>()

  const [updated] = await db
    .update(printerAccessories)
    .set(body)
    .where(and(eq(printerAccessories.id, aid), eq(printerAccessories.user_id, userId)))
    .returning()

  if (!updated) return err(c, 'Accessory not found', 404)
  return ok(c, updated)
})

printerRoutes.delete('/:id/accessories/:aid', async (c) => {
  const userId = c.get('userId')
  const aid = c.req.param('aid')

  const deleted = await db
    .delete(printerAccessories)
    .where(and(eq(printerAccessories.id, aid), eq(printerAccessories.user_id, userId)))
    .returning({ id: printerAccessories.id })

  if (deleted.length === 0) return err(c, 'Accessory not found', 404)
  return ok(c, { deleted: true })
})

// ── Slot assignments ──────────────────────────────────────────

printerRoutes.get('/:id/slots', async (c) => {
  const userId = c.get('userId')
  const printerId = c.req.param('id')

  const slots = await db
    .select({
      slot:        slotAssignments,
      color_hex:   filamentProfiles.color_hex,
      color_name:  filamentProfiles.color_name,
      brand:       filamentProfiles.brand,
      material:    filamentProfiles.material,
      spool_status: spools.status,
    })
    .from(slotAssignments)
    .leftJoin(spools, eq(slotAssignments.spool_id, spools.id))
    .leftJoin(filamentProfiles, eq(slotAssignments.filament_profile_id, filamentProfiles.id))
    .where(and(eq(slotAssignments.printer_id, printerId), eq(slotAssignments.user_id, userId)))
    .orderBy(asc(slotAssignments.slot_number))

  return ok(c, slots)
})

printerRoutes.patch('/:id/slots/:slot', async (c) => {
  const userId = c.get('userId')
  const printerId = c.req.param('id')
  const slotNumber = parseInt(c.req.param('slot'), 10)

  type SlotBody = {
    spool_id: string | null
    filament_profile_id?: string | null
    slot_label?: string
    accessory_id?: string | null
  }

  const body = await c.req.json<SlotBody>()

  // Upsert slot assignment
  const existing = await db
    .select()
    .from(slotAssignments)
    .where(
      and(
        eq(slotAssignments.printer_id, printerId),
        eq(slotAssignments.user_id, userId),
        eq(slotAssignments.slot_number, slotNumber),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    const [updated] = await db
      .update(slotAssignments)
      .set({
        spool_id:           body.spool_id ?? null,
        filament_profile_id: body.filament_profile_id ?? null,
        slot_label:         body.slot_label ?? null,
        assigned_at:        new Date(),
      })
      .where(eq(slotAssignments.id, existing[0].id))
      .returning()
    return ok(c, updated)
  }

  const [created] = await db
    .insert(slotAssignments)
    .values({
      user_id:             userId,
      printer_id:          printerId,
      accessory_id:        body.accessory_id ?? null,
      slot_number:         slotNumber,
      slot_label:          body.slot_label ?? null,
      spool_id:            body.spool_id ?? null,
      filament_profile_id: body.filament_profile_id ?? null,
    })
    .returning()

  return ok(c, created, 201)
})

// ── Compatibility check ───────────────────────────────────────

/**
 * GET /api/printers/:id/compat/:profileId
 * Check if a filament profile is compatible with a printer.
 */
printerRoutes.get('/:id/compat/:profileId', async (c) => {
  const userId    = c.get('userId')
  const printerId = c.req.param('id')
  const profileId = c.req.param('profileId')

  const result = await checkCompatibility(printerId, profileId, userId)
  return ok(c, result)
})

export default printerRoutes
