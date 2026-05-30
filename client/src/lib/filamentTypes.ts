import type { FilamentProfile, Spool } from '@shared/types'

export type { FilamentProfile, Spool }

export interface SpoolCounts {
  active: number
  reserve: number
  partial_reserve: number
  total: number
}

export interface FilamentProfileWithCounts extends FilamentProfile {
  spool_counts: SpoolCounts
}

export interface SpoolWithRemaining extends Spool {
  filament_remaining_g: number | null
  filament_remaining_pct: number | null
}

export interface FilamentProfileDetail extends FilamentProfile {
  spools: SpoolWithRemaining[]
}
