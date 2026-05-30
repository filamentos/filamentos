import { eq, and, isNull, or } from 'drizzle-orm'
import { db } from '../db/client'
import {
  alerts,
  filamentProfiles,
  spools,
  printerItems,
  installedItems,
} from '../db/schema'

// ── Types ─────────────────────────────────────────────────────

interface AlertCandidate {
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  entity_type: string
  entity_id: string
  message: string
  reorder_url?: string | null
}

// ── De-duplication guard ──────────────────────────────────────

/**
 * Returns true if an active (unread + undismissed) alert already
 * exists for this entity + alert_type combination.
 */
async function alertExists(
  userId: string,
  alertType: string,
  entityId: string,
): Promise<boolean> {
  const [existing] = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(
      and(
        eq(alerts.user_id, userId),
        eq(alerts.alert_type, alertType),
        eq(alerts.entity_id, entityId),
        eq(alerts.is_read, false),
        eq(alerts.is_dismissed, false),
      ),
    )
    .limit(1)
  return !!existing
}

// ── Main evaluation function ──────────────────────────────────

/**
 * Evaluates all alert rules for a user and inserts any new alerts.
 * Safe to call on every mutation — de-duplicates before inserting.
 */
export async function evaluateAlerts(userId: string): Promise<void> {
  const candidates: AlertCandidate[] = []

  // ── Filament alerts ───────────────────────────────────────

  // Load all active/reserve spools with their profile data
  const spoolRows = await db
    .select({
      spool_id:                  spools.id,
      spool_status:              spools.status,
      current_gross_weight_g:    spools.current_gross_weight_g,
      reorder_url:               filamentProfiles.reorder_url,
      profile_id:                filamentProfiles.id,
      brand:                     filamentProfiles.brand,
      material:                  filamentProfiles.material,
      color_name:                filamentProfiles.color_name,
      empty_spool_weight_g:      filamentProfiles.empty_spool_weight_g,
      net_spool_weight_g:        filamentProfiles.net_spool_weight_g,
      alert_mode:                filamentProfiles.alert_mode,
      low_gram_threshold_g:      filamentProfiles.low_gram_threshold_g,
      critical_gram_threshold_g: filamentProfiles.critical_gram_threshold_g,
      low_spool_threshold:       filamentProfiles.low_spool_threshold,
      alert_on_last_spool:       filamentProfiles.alert_on_last_spool,
    })
    .from(spools)
    .innerJoin(filamentProfiles, eq(spools.profile_id, filamentProfiles.id))
    .where(
      and(
        eq(spools.user_id, userId),
        or(
          eq(spools.status, 'active'),
          eq(spools.status, 'reserve'),
          eq(spools.status, 'partial_reserve'),
        ),
      ),
    )

  // Group spools by profile for spool-count checks
  const profileMap = new Map<
    string,
    { active: number; reserve: number; row: typeof spoolRows[0] }
  >()

  for (const row of spoolRows) {
    const entry = profileMap.get(row.profile_id) ?? {
      active: 0,
      reserve: 0,
      row,
    }
    if (row.spool_status === 'active') entry.active++
    else entry.reserve++
    profileMap.set(row.profile_id, entry)
  }

  // Per-spool gram checks (only active spools with known weights)
  for (const row of spoolRows) {
    if (row.spool_status !== 'active') continue
    if (!row.current_gross_weight_g || !row.empty_spool_weight_g) continue
    if (row.alert_mode === 'off') continue

    const remaining =
      parseFloat(row.current_gross_weight_g) -
      parseFloat(row.empty_spool_weight_g)

    const label = `${row.brand} ${row.material}${row.color_name ? ` (${row.color_name})` : ''}`

    if (
      (row.alert_mode === 'gram' || row.alert_mode === 'both') &&
      row.critical_gram_threshold_g
    ) {
      if (remaining <= parseFloat(row.critical_gram_threshold_g)) {
        candidates.push({
          alert_type: 'critical_gram',
          severity: 'critical',
          entity_type: 'spool',
          entity_id: row.spool_id,
          message: `${label} — only ${remaining.toFixed(0)}g remaining (critical)`,
          reorder_url: row.reorder_url,
        })
        continue // skip low_gram if already critical
      }
      if (row.low_gram_threshold_g && remaining <= parseFloat(row.low_gram_threshold_g)) {
        candidates.push({
          alert_type: 'low_gram',
          severity: 'warning',
          entity_type: 'spool',
          entity_id: row.spool_id,
          message: `${label} — only ${remaining.toFixed(0)}g remaining`,
          reorder_url: row.reorder_url,
        })
      }
    }
  }

  // Per-profile spool count checks
  for (const [profileId, counts] of profileMap.entries()) {
    const { row } = counts
    if (row.alert_mode === 'off') continue
    if (row.alert_mode !== 'spool' && row.alert_mode !== 'both') continue

    const label = `${row.brand} ${row.material}${row.color_name ? ` (${row.color_name})` : ''}`
    const reserveCount = counts.reserve

    // Last spool: active opened, no reserves left
    if (
      row.alert_on_last_spool &&
      counts.active > 0 &&
      reserveCount === 0
    ) {
      candidates.push({
        alert_type: 'last_spool',
        severity: 'critical',
        entity_type: 'filament_profile',
        entity_id: profileId,
        message: `${label} — this is your last spool, no reserves remaining`,
        reorder_url: row.reorder_url,
      })
    } else if (
      row.low_spool_threshold != null &&
      reserveCount <= row.low_spool_threshold
    ) {
      candidates.push({
        alert_type: 'low_spool',
        severity: 'warning',
        entity_type: 'filament_profile',
        entity_id: profileId,
        message: `${label} — only ${reserveCount} reserve spool${reserveCount === 1 ? '' : 's'} left`,
        reorder_url: row.reorder_url,
      })
    }
  }

  // ── Parts alerts ──────────────────────────────────────────

  const parts = await db
    .select()
    .from(printerItems)
    .where(eq(printerItems.user_id, userId))

  for (const part of parts) {
    const qty = part.quantity_in_stock ?? 0
    const threshold = part.low_stock_threshold ?? 1

    if (qty === 0) {
      candidates.push({
        alert_type: 'low_part',
        severity: 'critical',
        entity_type: 'printer_item',
        entity_id: part.id,
        message: `${part.name} — out of stock`,
        reorder_url: part.reorder_url,
      })
    } else if (qty <= threshold) {
      candidates.push({
        alert_type: 'low_part',
        severity: 'warning',
        entity_type: 'printer_item',
        entity_id: part.id,
        message: `${part.name} — only ${qty} left (threshold: ${threshold})`,
        reorder_url: part.reorder_url,
      })
    }
  }

  // ── Installed parts wear alerts ───────────────────────────

  const installed = await db
    .select({
      id:                       installedItems.id,
      printer_item_id:          installedItems.printer_item_id,
      hours_on_part:            installedItems.hours_on_part,
      replacement_interval_hrs: installedItems.replacement_interval_hrs,
      notes:                    installedItems.notes,
    })
    .from(installedItems)
    .where(
      and(
        eq(installedItems.user_id, userId),
        eq(installedItems.is_current, true),
      ),
    )

  for (const item of installed) {
    if (!item.hours_on_part || !item.replacement_interval_hrs) continue

    const hours    = parseFloat(item.hours_on_part)
    const interval = parseFloat(item.replacement_interval_hrs)

    if (hours >= interval) {
      candidates.push({
        alert_type: 'wear_reminder',
        severity: 'warning',
        entity_type: 'installed_item',
        entity_id: item.id,
        message: `Installed part has ${hours.toFixed(0)}h — replacement due at ${interval.toFixed(0)}h`,
      })
    }
  }

  // ── Insert non-duplicate candidates ──────────────────────

  for (const candidate of candidates) {
    const exists = await alertExists(
      userId,
      candidate.alert_type,
      candidate.entity_id,
    )
    if (!exists) {
      await db.insert(alerts).values({
        user_id:     userId,
        alert_type:  candidate.alert_type,
        severity:    candidate.severity,
        entity_type: candidate.entity_type,
        entity_id:   candidate.entity_id,
        message:     candidate.message,
        reorder_url: candidate.reorder_url ?? null,
      })
    }
  }
}
