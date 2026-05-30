// ── Known printer model reference data ───────────────────────
// When user selects a known model, these specs auto-fill.

export interface PrinterModelRef {
  brand: string
  model: string
  printer_type: string
  motion_system: string
  build_volume_x_mm: number
  build_volume_y_mm: number
  build_volume_z_mm: number
  max_nozzle_temp_c: number
  max_bed_temp_c: number
  has_enclosure: boolean
  filament_diameter_mm: number
  direct_drive: boolean
  native_color_slots: number
  multi_color_system: string | null
}

export const PRINTER_MODELS: PrinterModelRef[] = [
  // ── Bambu Lab ─────────────────────────────────────────────
  {
    brand: 'Bambu Lab', model: 'X1 Carbon', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 256, build_volume_y_mm: 256, build_volume_z_mm: 256,
    max_nozzle_temp_c: 300, max_bed_temp_c: 120, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Bambu Lab', model: 'X1E', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 256, build_volume_y_mm: 256, build_volume_z_mm: 256,
    max_nozzle_temp_c: 320, max_bed_temp_c: 120, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Bambu Lab', model: 'P1S', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 256, build_volume_y_mm: 256, build_volume_z_mm: 256,
    max_nozzle_temp_c: 300, max_bed_temp_c: 120, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Bambu Lab', model: 'P1P', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 256, build_volume_y_mm: 256, build_volume_z_mm: 256,
    max_nozzle_temp_c: 300, max_bed_temp_c: 110, has_enclosure: false,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Bambu Lab', model: 'P2S', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 256, build_volume_y_mm: 256, build_volume_z_mm: 256,
    max_nozzle_temp_c: 300, max_bed_temp_c: 120, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Bambu Lab', model: 'A1', printer_type: 'FDM',
    motion_system: 'bedslinger', build_volume_x_mm: 256, build_volume_y_mm: 256, build_volume_z_mm: 256,
    max_nozzle_temp_c: 300, max_bed_temp_c: 100, has_enclosure: false,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 4, multi_color_system: 'IFS',
  },
  {
    brand: 'Bambu Lab', model: 'A1 Mini', printer_type: 'FDM',
    motion_system: 'bedslinger', build_volume_x_mm: 180, build_volume_y_mm: 180, build_volume_z_mm: 180,
    max_nozzle_temp_c: 300, max_bed_temp_c: 100, has_enclosure: false,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 4, multi_color_system: 'IFS',
  },
  {
    brand: 'Bambu Lab', model: 'H2D', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 350, build_volume_y_mm: 320, build_volume_z_mm: 350,
    max_nozzle_temp_c: 320, max_bed_temp_c: 120, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  // ── Flashforge ────────────────────────────────────────────
  {
    brand: 'Flashforge', model: 'AD5X', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 280, build_volume_y_mm: 280, build_volume_z_mm: 280,
    max_nozzle_temp_c: 320, max_bed_temp_c: 120, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 5, multi_color_system: 'IFS',
  },
  {
    brand: 'Flashforge', model: 'AD5M', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 220, build_volume_y_mm: 220, build_volume_z_mm: 220,
    max_nozzle_temp_c: 300, max_bed_temp_c: 110, has_enclosure: false,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Flashforge', model: 'Adventurer 5M Pro', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 220, build_volume_y_mm: 220, build_volume_z_mm: 220,
    max_nozzle_temp_c: 280, max_bed_temp_c: 110, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  // ── Prusa ─────────────────────────────────────────────────
  {
    brand: 'Prusa', model: 'MK4', printer_type: 'FDM',
    motion_system: 'bedslinger', build_volume_x_mm: 250, build_volume_y_mm: 210, build_volume_z_mm: 220,
    max_nozzle_temp_c: 290, max_bed_temp_c: 110, has_enclosure: false,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Prusa', model: 'MK3.9', printer_type: 'FDM',
    motion_system: 'bedslinger', build_volume_x_mm: 250, build_volume_y_mm: 210, build_volume_z_mm: 220,
    max_nozzle_temp_c: 290, max_bed_temp_c: 110, has_enclosure: false,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Prusa', model: 'Mini+', printer_type: 'FDM',
    motion_system: 'bedslinger', build_volume_x_mm: 180, build_volume_y_mm: 180, build_volume_z_mm: 180,
    max_nozzle_temp_c: 280, max_bed_temp_c: 100, has_enclosure: false,
    filament_diameter_mm: 1.75, direct_drive: false,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Prusa', model: 'XL', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 360, build_volume_y_mm: 360, build_volume_z_mm: 360,
    max_nozzle_temp_c: 290, max_bed_temp_c: 110, has_enclosure: false,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  // ── Creality ─────────────────────────────────────────────
  {
    brand: 'Creality', model: 'Ender 3 V3', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 220, build_volume_y_mm: 220, build_volume_z_mm: 250,
    max_nozzle_temp_c: 300, max_bed_temp_c: 110, has_enclosure: false,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Creality', model: 'K1', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 220, build_volume_y_mm: 220, build_volume_z_mm: 250,
    max_nozzle_temp_c: 300, max_bed_temp_c: 100, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Creality', model: 'K1C', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 220, build_volume_y_mm: 220, build_volume_z_mm: 250,
    max_nozzle_temp_c: 300, max_bed_temp_c: 100, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Creality', model: 'K2 Plus', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 350, build_volume_y_mm: 350, build_volume_z_mm: 350,
    max_nozzle_temp_c: 300, max_bed_temp_c: 110, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  // ── Voron ─────────────────────────────────────────────────
  {
    brand: 'Voron', model: '2.4 (250mm)', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 250, build_volume_y_mm: 250, build_volume_z_mm: 250,
    max_nozzle_temp_c: 300, max_bed_temp_c: 120, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Voron', model: 'Trident (250mm)', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 250, build_volume_y_mm: 250, build_volume_z_mm: 250,
    max_nozzle_temp_c: 300, max_bed_temp_c: 120, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
  {
    brand: 'Voron', model: '0.2', printer_type: 'FDM',
    motion_system: 'CoreXY', build_volume_x_mm: 120, build_volume_y_mm: 120, build_volume_z_mm: 120,
    max_nozzle_temp_c: 300, max_bed_temp_c: 120, has_enclosure: true,
    filament_diameter_mm: 1.75, direct_drive: true,
    native_color_slots: 0, multi_color_system: null,
  },
]

/** Look up a printer model by brand + model name */
export function findPrinterModel(brand: string, model: string): PrinterModelRef | undefined {
  return PRINTER_MODELS.find(
    (m) => m.brand.toLowerCase() === brand.toLowerCase() &&
           m.model.toLowerCase() === model.toLowerCase(),
  )
}
