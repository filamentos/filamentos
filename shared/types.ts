// ── Users & Auth ──────────────────────────────────────────────

export interface User {
  id: string
  email: string
  display_name: string | null
  experience_level: 'beginner' | 'casual' | 'pro'
  mode: 'maker' | 'farm'
  preferred_currency: string
  preferred_language: 'en' | 'es'
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  expires_at: string
}

// ── Filament ──────────────────────────────────────────────────

export interface FilamentProfile {
  id: string
  user_id: string
  brand: string
  material: string
  material_variant: string | null
  color_name: string | null
  color_hex: string | null
  diameter_mm: number
  empty_spool_weight_g: number | null
  net_spool_weight_g: number
  cost_per_spool: number | null
  currency: string
  reorder_url: string | null
  sku: string | null
  alert_mode: 'gram' | 'spool' | 'both' | 'off'
  low_gram_threshold_g: number
  critical_gram_threshold_g: number
  low_spool_threshold: number
  alert_on_last_spool: boolean
  price_target: number | null
  notes: string | null
  created_at: string
}

export interface Spool {
  id: string
  user_id: string
  profile_id: string
  status: 'active' | 'reserve' | 'partial_reserve' | 'empty' | 'archived'
  purchase_date: string | null
  opened_date: string | null
  empty_date: string | null
  current_gross_weight_g: number | null
  opening_gross_weight_g: number | null
  storage_location: string | null
  is_in_drybox: boolean
  lot_number: string | null
  purchase_record_id: string | null
  notes: string | null
  created_at: string
}

export interface WeightLog {
  id: string
  spool_id: string
  user_id: string
  logged_at: string
  gross_weight_g: number
  event_type: 'open' | 'weigh' | 'pre_print' | 'post_print' | 'empty'
  slicer_estimate_g: number | null
  notes: string | null
}

// ── Alerts ────────────────────────────────────────────────────

export interface Alert {
  id: string
  user_id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  entity_type: string | null
  entity_id: string | null
  message: string
  reorder_url: string | null
  is_read: boolean
  is_dismissed: boolean
  created_at: string
}

// ── API response shapes ───────────────────────────────────────

export interface ApiError {
  error: string
}

export interface MagicLinkRequest {
  email: string
}

export interface MagicLinkResponse {
  ok: boolean
}
