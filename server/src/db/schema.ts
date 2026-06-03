import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  date,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core'

// ── Material Reference ─────────────────────────────────────────

export const materialReference = pgTable('material_reference', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
  variants: text('variants').array(),
  nozzle_min: integer('nozzle_min'),
  nozzle_max: integer('nozzle_max'),
  nozzle_recommended: integer('nozzle_recommended'),
  bed_min: integer('bed_min'),
  bed_max: integer('bed_max'),
  bed_recommended: integer('bed_recommended'),
  requires_enclosure: boolean('requires_enclosure').default(false),
  dry_before_print: boolean('dry_before_print').default(false),
  drying_temp_c: integer('drying_temp_c'),
  drying_hours: numeric('drying_hours', { precision: 4, scale: 1 }),
  cooling_fan: text('cooling_fan').default('high'), // none | low | high
  density_g_cm3: numeric('density_g_cm3', { precision: 5, scale: 3 }),
  tensile_strength_mpa: integer('tensile_strength_mpa'),
  heat_resistance_c: integer('heat_resistance_c'),
  uv_resistant: boolean('uv_resistant').default(false),
  food_safe: boolean('food_safe').default(false),
  is_abrasive: boolean('is_abrasive').default(false),
  moisture_sensitivity_days: integer('moisture_sensitivity_days'),
  beginner_tip: text('beginner_tip'),
})
import { sql } from 'drizzle-orm'

// ── Auth ──────────────────────────────────────────────────────

export const allowedEmails = pgTable('allowed_emails', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').unique().notNull(),
  invited_at: timestamp('invited_at', { withTimezone: true }).defaultNow(),
  invited_by: uuid('invited_by'),
  first_login_at: timestamp('first_login_at', { withTimezone: true }),
  notes: text('notes'),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').unique().notNull(),
  display_name: text('display_name'),
  experience_level: text('experience_level').default('beginner').notNull(),
  mode: text('mode').default('maker').notNull(),
  preferred_currency: text('preferred_currency').default('USD').notNull(),
  preferred_language: text('preferred_language').default('en').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const magicLinks = pgTable('magic_links', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull(),
  token_hash: text('token_hash').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  used_at: timestamp('used_at', { withTimezone: true }),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token_hash: text('token_hash').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  last_used_at: timestamp('last_used_at', { withTimezone: true }),
})

// ── Purchase Sources ──────────────────────────────────────────

export const purchaseSources = pgTable('purchase_sources', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  domain: text('domain'),
  source_type: text('source_type'),
  is_official: boolean('is_official').default(false),
  reliability_note: text('reliability_note'),
  shipping_note: text('shipping_note'),
  affiliate_program: text('affiliate_program'),
  user_id: uuid('user_id').references(() => users.id),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const purchaseRecords = pgTable('purchase_records', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  item_type: text('item_type').notNull(),
  item_ref_id: uuid('item_ref_id'),
  purchase_date: date('purchase_date').notNull(),
  quantity: integer('quantity').default(1),
  price_per_unit: numeric('price_per_unit', { precision: 10, scale: 2 }),
  total_paid: numeric('total_paid', { precision: 10, scale: 2 }),
  currency: text('currency').default('USD'),
  source_id: uuid('source_id').references(() => purchaseSources.id),
  product_url: text('product_url'),
  product_title: text('product_title'),
  order_id: text('order_id'),
  was_on_sale: boolean('was_on_sale').default(false),
  coupon_code: text('coupon_code'),
  is_secondhand: boolean('is_secondhand').default(false),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Filament ──────────────────────────────────────────────────

export const filamentProfiles = pgTable('filament_profiles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  brand: text('brand').notNull(),
  material: text('material').notNull(),
  material_variant: text('material_variant'),
  color_name: text('color_name'),
  color_hex: text('color_hex'),
  diameter_mm: numeric('diameter_mm', { precision: 4, scale: 2 }).default('1.75').notNull(),
  empty_spool_weight_g: numeric('empty_spool_weight_g', { precision: 6, scale: 1 }),
  net_spool_weight_g: numeric('net_spool_weight_g', { precision: 6, scale: 1 }).default('1000').notNull(),
  cost_per_spool: numeric('cost_per_spool', { precision: 8, scale: 2 }),
  currency: text('currency').default('USD').notNull(),
  reorder_url: text('reorder_url'),
  sku: text('sku'),
  alert_mode: text('alert_mode').default('both').notNull(),
  low_gram_threshold_g: numeric('low_gram_threshold_g', { precision: 6, scale: 1 }).default('150').notNull(),
  critical_gram_threshold_g: numeric('critical_gram_threshold_g', { precision: 6, scale: 1 }).default('50').notNull(),
  low_spool_threshold: integer('low_spool_threshold').default(1).notNull(),
  alert_on_last_spool: boolean('alert_on_last_spool').default(true).notNull(),
  price_target: numeric('price_target', { precision: 8, scale: 2 }),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const spools = pgTable('spools', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  profile_id: uuid('profile_id')
    .notNull()
    .references(() => filamentProfiles.id, { onDelete: 'cascade' }),
  status: text('status').default('reserve').notNull(), // ordered | reserve | partial_reserve | active | empty | archived
  purchase_date: date('purchase_date'),
  ordered_date: date('ordered_date'),
  received_date: date('received_date'),
  opened_date: date('opened_date'),
  empty_date: date('empty_date'),
  current_gross_weight_g: numeric('current_gross_weight_g', { precision: 6, scale: 1 }),
  opening_gross_weight_g: numeric('opening_gross_weight_g', { precision: 6, scale: 1 }),
  storage_location: text('storage_location'),
  is_in_drybox: boolean('is_in_drybox').default(false).notNull(),
  lot_number: text('lot_number'),
  purchase_record_id: uuid('purchase_record_id').references(() => purchaseRecords.id),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const weightLogs = pgTable('weight_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  spool_id: uuid('spool_id')
    .notNull()
    .references(() => spools.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  logged_at: timestamp('logged_at', { withTimezone: true }).defaultNow(),
  gross_weight_g: numeric('gross_weight_g', { precision: 6, scale: 1 }).notNull(),
  event_type: text('event_type').default('weigh').notNull(),
  slicer_estimate_g: numeric('slicer_estimate_g', { precision: 6, scale: 1 }),
  notes: text('notes'),
})

// ── Printers ──────────────────────────────────────────────────

export const printers = pgTable('printers', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  nickname: text('nickname'),
  printer_type: text('printer_type').default('FDM').notNull(),
  motion_system: text('motion_system'),
  build_volume_x_mm: integer('build_volume_x_mm'),
  build_volume_y_mm: integer('build_volume_y_mm'),
  build_volume_z_mm: integer('build_volume_z_mm'),
  max_nozzle_temp_c: integer('max_nozzle_temp_c'),
  max_bed_temp_c: integer('max_bed_temp_c'),
  has_enclosure: boolean('has_enclosure').default(false).notNull(),
  filament_diameter_mm: numeric('filament_diameter_mm', { precision: 4, scale: 2 }).default('1.75').notNull(),
  direct_drive: boolean('direct_drive').default(false).notNull(),
  current_nozzle_diameter_mm: numeric('current_nozzle_diameter_mm', { precision: 4, scale: 2 }).default('0.4').notNull(),
  current_nozzle_material: text('current_nozzle_material').default('brass').notNull(),
  multi_color_system: text('multi_color_system'),
  native_color_slots: integer('native_color_slots').default(0).notNull(),
  status: text('status').default('active').notNull(),
  purchase_date: date('purchase_date'),
  purchase_record_id: uuid('purchase_record_id').references(() => purchaseRecords.id),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const printerAccessories = pgTable('printer_accessories', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  printer_id: uuid('printer_id')
    .notNull()
    .references(() => printers.id, { onDelete: 'cascade' }),
  accessory_type: text('accessory_type').notNull(),
  brand: text('brand'),
  model: text('model'),
  unit_index: integer('unit_index').default(1),
  slots_added: integer('slots_added').default(0),
  drying_capable: boolean('drying_capable').default(false),
  rfid_capable: boolean('rfid_capable').default(false),
  max_dry_temp_c: integer('max_dry_temp_c'),
  installed_date: date('installed_date'),
  purchase_record_id: uuid('purchase_record_id').references(() => purchaseRecords.id),
  is_installed: boolean('is_installed').default(true),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const slotAssignments = pgTable('slot_assignments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  printer_id: uuid('printer_id')
    .notNull()
    .references(() => printers.id, { onDelete: 'cascade' }),
  accessory_id: uuid('accessory_id').references(() => printerAccessories.id),
  slot_number: integer('slot_number').notNull(),
  slot_label: text('slot_label'),
  spool_id: uuid('spool_id').references(() => spools.id),
  filament_profile_id: uuid('filament_profile_id').references(() => filamentProfiles.id),
  assigned_at: timestamp('assigned_at', { withTimezone: true }).defaultNow(),
})

// ── Printer Parts ─────────────────────────────────────────────

export const printerItems = pgTable('printer_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  printer_id: uuid('printer_id').references(() => printers.id),
  category: text('category').notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  spec: jsonb('spec'),
  quantity_in_stock: integer('quantity_in_stock').default(0).notNull(),
  low_stock_threshold: integer('low_stock_threshold').default(1).notNull(),
  reorder_url: text('reorder_url'),
  purchase_record_id: uuid('purchase_record_id').references(() => purchaseRecords.id),
  storage_location: text('storage_location'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const installedItems = pgTable('installed_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  printer_id: uuid('printer_id')
    .notNull()
    .references(() => printers.id, { onDelete: 'cascade' }),
  printer_item_id: uuid('printer_item_id').references(() => printerItems.id),
  installed_date: date('installed_date'),
  hours_on_part: numeric('hours_on_part', { precision: 8, scale: 1 }).default('0'),
  replacement_interval_hrs: numeric('replacement_interval_hrs', { precision: 8, scale: 1 }),
  replaced_reason: text('replaced_reason'),
  is_current: boolean('is_current').default(true).notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Workshop ──────────────────────────────────────────────────

export const workshopItems = pgTable('workshop_items', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  name: text('name').notNull(),
  spec: jsonb('spec'),
  unit: text('unit').default('pcs').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 2 }).default('0').notNull(),
  low_stock_threshold: numeric('low_stock_threshold', { precision: 10, scale: 2 }).default('5').notNull(),
  source_kit_id: uuid('source_kit_id').references(() => purchaseRecords.id),
  reorder_url: text('reorder_url'),
  storage_location: text('storage_location'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Projects (unified: design + cost + selling) ───────────────

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Identity
  project_url: text('project_url'),
  platform: text('platform').default('other').notNull(), // makerworld | printables | thingiverse | cults3d | other
  status: text('status').default('want_to_print').notNull(), // want_to_print | printing | completed
  title: text('title'),
  designer: text('designer'),

  // Printer
  printer_id: uuid('printer_id').references(() => printers.id, { onDelete: 'set null' }),

  // Assembly (per finished item)
  assembly_time_min_per_unit: numeric('assembly_time_min_per_unit', { precision: 8, scale: 1 }),

  // Selling
  units_produced: integer('units_produced').default(1).notNull(), // finished sellable items the whole project yields
  venue: text('venue').default('other').notNull(), // farmers_market | etsy | local | convention | other
  event_date: date('event_date'),
  packaging_cost_per_unit: numeric('packaging_cost_per_unit', { precision: 8, scale: 2 }).default('0'),
  table_fee: numeric('table_fee', { precision: 8, scale: 2 }).default('0'),
  platform_fee_pct: numeric('platform_fee_pct', { precision: 5, scale: 2 }).default('0'),
  target_price: numeric('target_price', { precision: 8, scale: 2 }),
  units_sold: integer('units_sold'),
  actual_revenue: numeric('actual_revenue', { precision: 10, scale: 2 }),

  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const projectPlates = pgTable('project_plates', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  plate_number: integer('plate_number').default(1).notNull(),
  plate_name: text('plate_name'),
  print_time_min: numeric('print_time_min', { precision: 8, scale: 1 }), // slicer time to print this plate once
  batch_quantity: integer('batch_quantity').default(1).notNull(),         // how many times this plate is run
})

export const projectPlateColors = pgTable('project_plate_colors', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  plate_id: uuid('plate_id')
    .notNull()
    .references(() => projectPlates.id, { onDelete: 'cascade' }),
  color_label: text('color_label'),
  filament_profile_id: uuid('filament_profile_id').references(() => filamentProfiles.id, { onDelete: 'set null' }),
  grams_used: numeric('grams_used', { precision: 8, scale: 1 }).default('0').notNull(),
})

export const projectParts = pgTable('project_parts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  workshop_item_id: uuid('workshop_item_id').references(() => workshopItems.id, { onDelete: 'set null' }),
  quantity_per_unit: numeric('quantity_per_unit', { precision: 10, scale: 2 }).default('1').notNull(),
})

// ── Alerts ────────────────────────────────────────────────────

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  alert_type: text('alert_type').notNull(),
  severity: text('severity').default('warning').notNull(),
  entity_type: text('entity_type'),
  entity_id: uuid('entity_id'),
  message: text('message').notNull(),
  reorder_url: text('reorder_url'),
  is_read: boolean('is_read').default(false).notNull(),
  is_dismissed: boolean('is_dismissed').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Cost & Pricing Settings (applies to all projects) ─────────

export const userQuoteSettings = pgTable('user_quote_settings', {
  user_id: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  electricity_rate_per_kwh: numeric('electricity_rate_per_kwh', { precision: 6, scale: 4 }).default('0.14'),
  default_printer_wattage_w: integer('default_printer_wattage_w').default(200),
  labor_rate_per_hr: numeric('labor_rate_per_hr', { precision: 8, scale: 2 }).default('15.00'),
  include_electricity: boolean('include_electricity').default(true),
  include_labor: boolean('include_labor').default(true),
  include_wear_costs: boolean('include_wear_costs').default(true),
  default_markup: numeric('default_markup', { precision: 4, scale: 2 }).default('3.0'),
  default_venue: text('default_venue').default('farmers_market'),
  default_packaging_cost: numeric('default_packaging_cost', { precision: 8, scale: 2 }).default('0'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
