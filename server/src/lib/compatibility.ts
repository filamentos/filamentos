import { eq, and } from 'drizzle-orm'
import { db } from '../db/client'
import { printers, filamentProfiles } from '../db/schema'

// ── Material reference ────────────────────────────────────────

interface MaterialProps {
  nozzle_min_temp: number
  requires_enclosure: boolean
  is_abrasive: boolean
  tpu_ams_warning: boolean
}

const MATERIAL_PROPS: Record<string, MaterialProps> = {
  PLA:     { nozzle_min_temp: 180, requires_enclosure: false, is_abrasive: false, tpu_ams_warning: false },
  'PLA+':  { nozzle_min_temp: 185, requires_enclosure: false, is_abrasive: false, tpu_ams_warning: false },
  PETG:    { nozzle_min_temp: 220, requires_enclosure: false, is_abrasive: false, tpu_ams_warning: false },
  ABS:     { nozzle_min_temp: 230, requires_enclosure: true,  is_abrasive: false, tpu_ams_warning: false },
  ASA:     { nozzle_min_temp: 240, requires_enclosure: true,  is_abrasive: false, tpu_ams_warning: false },
  TPU:     { nozzle_min_temp: 220, requires_enclosure: false, is_abrasive: false, tpu_ams_warning: true  },
  'TPU 95A': { nozzle_min_temp: 220, requires_enclosure: false, is_abrasive: false, tpu_ams_warning: true },
  Nylon:   { nozzle_min_temp: 240, requires_enclosure: true,  is_abrasive: false, tpu_ams_warning: false },
  PC:      { nozzle_min_temp: 260, requires_enclosure: true,  is_abrasive: false, tpu_ams_warning: false },
  'PLA-CF':   { nozzle_min_temp: 200, requires_enclosure: false, is_abrasive: true,  tpu_ams_warning: false },
  'PETG-CF':  { nozzle_min_temp: 230, requires_enclosure: false, is_abrasive: true,  tpu_ams_warning: false },
  'PAHT-CF':  { nozzle_min_temp: 270, requires_enclosure: true,  is_abrasive: true,  tpu_ams_warning: false },
  'Silk PLA': { nozzle_min_temp: 185, requires_enclosure: false, is_abrasive: false, tpu_ams_warning: false },
  'Matte PLA':{ nozzle_min_temp: 185, requires_enclosure: false, is_abrasive: false, tpu_ams_warning: false },
}

// ── Result type ───────────────────────────────────────────────

export interface CompatibilityResult {
  compatible: boolean
  errors:   string[]
  warnings: string[]
}

// ── Main function ─────────────────────────────────────────────

export async function checkCompatibility(
  printerId: string,
  filamentProfileId: string,
  userId: string,
): Promise<CompatibilityResult> {
  const errors:   string[] = []
  const warnings: string[] = []

  const [printer] = await db
    .select()
    .from(printers)
    .where(and(eq(printers.id, printerId), eq(printers.user_id, userId)))
    .limit(1)

  if (!printer) {
    return { compatible: false, errors: ['Printer not found'], warnings: [] }
  }

  const [profile] = await db
    .select()
    .from(filamentProfiles)
    .where(and(eq(filamentProfiles.id, filamentProfileId), eq(filamentProfiles.user_id, userId)))
    .limit(1)

  if (!profile) {
    return { compatible: false, errors: ['Filament profile not found'], warnings: [] }
  }

  // ── Rule 1: Diameter mismatch ─────────────────────────────
  const filamentDiam = parseFloat(profile.diameter_mm)
  const printerDiam  = parseFloat(printer.filament_diameter_mm)

  if (Math.abs(filamentDiam - printerDiam) > 0.05) {
    errors.push(
      `Diameter mismatch: filament is ${filamentDiam}mm, printer uses ${printerDiam}mm`,
    )
  }

  // ── Rules 2–5: Material-specific checks ──────────────────
  const matKey  = profile.material_variant
    ? `${profile.material} ${profile.material_variant}`
    : profile.material
  const matProps = MATERIAL_PROPS[matKey] ?? MATERIAL_PROPS[profile.material]

  if (matProps) {
    // Rule 2: Printer can't reach required nozzle temp
    if (
      printer.max_nozzle_temp_c != null &&
      matProps.nozzle_min_temp > printer.max_nozzle_temp_c
    ) {
      errors.push(
        `Printer max nozzle temp (${printer.max_nozzle_temp_c}°C) is below ` +
        `the minimum required for ${profile.material} (${matProps.nozzle_min_temp}°C)`,
      )
    }

    // Rule 3: Enclosure recommended / required
    if (matProps.requires_enclosure && !printer.has_enclosure) {
      warnings.push(
        `${profile.material} prints much better in an enclosure — ` +
        `this printer is open-frame`,
      )
    }

    // Rule 4: Abrasive filament + brass nozzle
    if (
      matProps.is_abrasive &&
      printer.current_nozzle_material === 'brass'
    ) {
      warnings.push(
        `${profile.material} is abrasive and will wear brass nozzles quickly — ` +
        `use hardened steel or ruby`,
      )
    }

    // Rule 5: TPU in AMS
    if (
      matProps.tpu_ams_warning &&
      printer.multi_color_system === 'AMS'
    ) {
      warnings.push(
        `TPU is not recommended in standard AMS systems — ` +
        `use the IFS on AD5X or load manually`,
      )
    }
  }

  return {
    compatible: errors.length === 0,
    errors,
    warnings,
  }
}
