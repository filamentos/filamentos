import { useState } from 'react'
import {
  IconPlus,
  IconWeight,
  IconRefresh,
  IconChevronDown,
  IconChevronRight,
  IconAlertTriangle,
  IconCircleCheck,
  IconAlertCircle,
  IconDroplet,
} from '@tabler/icons-react'
import AppShell from '../components/AppShell'
import Badge from '../components/ui/Badge'
import FilamentProgress from '../components/ui/FilamentProgress'
import Modal from '../components/ui/Modal'
import {
  useProfiles,
  useWeighSpool,
  useSwapSpool,
  useCreateProfile,
} from '../hooks/useFilament'
import type {
  FilamentProfileWithCounts,
  SpoolWithRemaining,
} from '../lib/filamentTypes'

// ── Alert severity badge for a profile ───────────────────────

function profileAlertBadge(profile: FilamentProfileWithCounts) {
  const { active, reserve } = profile.spool_counts
  const hasActiveSpoolData = active > 0

  if (!hasActiveSpoolData) {
    return <Badge variant="default">No active spool</Badge>
  }
  if (reserve === 0 && active <= 1) {
    return <Badge variant="danger" icon={IconAlertTriangle}>Last spool</Badge>
  }
  if (reserve <= (profile.low_spool_threshold ?? 1)) {
    return <Badge variant="warning" icon={IconAlertTriangle}>Low reserve</Badge>
  }
  return <Badge variant="success" icon={IconCircleCheck}>Good</Badge>
}

// ── Color swatch ──────────────────────────────────────────────

function ColorSwatch({ hex, name }: { hex: string | null; name: string | null }) {
  return (
    <div
      className="w-7 h-7 rounded-full border-2 shrink-0"
      style={{
        backgroundColor: hex ?? '#334155',
        borderColor: '#2e3e58',
      }}
      title={name ?? 'Unknown color'}
    />
  )
}

// ── Individual spool row ──────────────────────────────────────

interface SpoolRowProps {
  spool: SpoolWithRemaining
  emptySpoolWeight: number | string | null
  onWeigh: (spool: SpoolWithRemaining) => void
  onSwap: (spool: SpoolWithRemaining) => void
}

function SpoolRow({ spool, onWeigh, onSwap }: SpoolRowProps) {
  const statusBadge = () => {
    switch (spool.status) {
      case 'active':          return <Badge variant="accent">Active</Badge>
      case 'reserve':         return <Badge variant="info">Reserve</Badge>
      case 'partial_reserve': return <Badge variant="info">Partial</Badge>
      case 'empty':           return <Badge variant="default">Empty</Badge>
      case 'archived':        return <Badge variant="default">Archived</Badge>
      default:                return <Badge>{spool.status}</Badge>
    }
  }

  const remaining = spool.filament_remaining_g

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 group">
      {/* Status */}
      <div className="w-16 shrink-0">{statusBadge()}</div>

      {/* Remaining weight */}
      <div className="w-32 shrink-0">
        {remaining != null ? (
          <span className="mono text-xs text-ink-secondary">
            {remaining.toFixed(1)} g left
          </span>
        ) : (
          <span className="text-xs text-ink-tertiary">Not weighed</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex-1 min-w-0">
        {spool.status !== 'empty' && spool.status !== 'archived' ? (
          <FilamentProgress pct={spool.filament_remaining_pct} compact />
        ) : (
          <div className="h-1 w-full rounded-full bg-elevated opacity-40" />
        )}
      </div>

      {/* Storage */}
      <div className="w-24 shrink-0 hidden sm:block">
        {spool.storage_location ? (
          <span className="text-xs text-ink-tertiary truncate block">{spool.storage_location}</span>
        ) : null}
      </div>

      {/* Drybox indicator */}
      <div className="w-6 shrink-0 flex justify-center">
        {spool.is_in_drybox && (
          <IconDroplet size={14} className="text-info" title="In drybox" />
        )}
      </div>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {(spool.status === 'active' || spool.status === 'reserve' || spool.status === 'partial_reserve') && (
          <button
            onClick={() => onWeigh(spool)}
            className="btn-icon"
            title="Log weight"
          >
            <IconWeight size={14} />
          </button>
        )}
        {spool.status === 'active' && (
          <button
            onClick={() => onSwap(spool)}
            className="btn-icon"
            title="Spool swap"
          >
            <IconRefresh size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Profile card ──────────────────────────────────────────────

// ── Reserve count badge — color-coded by threshold ───────────

function ReserveBadge({ count, threshold }: { count: number; threshold: number }) {
  if (count === 0) {
    return <Badge variant="danger">0 reserve</Badge>
  }
  if (count <= threshold) {
    return <Badge variant="warning">{count} reserve</Badge>
  }
  return <Badge variant="info">{count} reserve</Badge>
}

interface ProfileCardProps {
  profile: FilamentProfileWithCounts
  onWeigh: (spool: SpoolWithRemaining) => void
  onSwap: (spool: SpoolWithRemaining) => void
}

function ProfileCard({ profile, onWeigh, onSwap }: ProfileCardProps) {
  const [expanded, setExpanded] = useState(false)

  const { reserve, partial_reserve, active } = profile.spool_counts
  const totalReserve = reserve + partial_reserve

  // Pick the first active spool's remaining % from profile-level data isn't available here —
  // we'd need the full detail. Use a placeholder progress if not yet loaded.

  return (
    <div className="card">
      {/* Card header */}
      <div
        className="flex items-center gap-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Chevron */}
        <button className="text-ink-tertiary shrink-0 hover:text-ink-secondary transition-colors">
          {expanded
            ? <IconChevronDown size={16} />
            : <IconChevronRight size={16} />}
        </button>

        {/* Color swatch */}
        <ColorSwatch hex={profile.color_hex} name={profile.color_name} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-md font-semibold text-ink-primary truncate">
            {profile.brand}{' '}
            <span className="text-ink-secondary font-normal">
              {profile.material}
              {profile.material_variant ? ` ${profile.material_variant}` : ''}
            </span>
          </p>
          {profile.color_name && (
            <p className="text-xs text-ink-tertiary">{profile.color_name}</p>
          )}
        </div>

        {/* Spool count badge */}
        <div className="flex items-center gap-2 shrink-0">
          {active > 0 && (
            <Badge variant="accent">{active} active</Badge>
          )}
          <ReserveBadge count={totalReserve} threshold={profile.low_spool_threshold ?? 1} />
          {profileAlertBadge(profile)}
        </div>
      </div>

      {/* Expanded: spool list */}
      {expanded && (
        <ProfileSpoolList
          profile={profile}
          onWeigh={onWeigh}
          onSwap={onSwap}
        />
      )}
    </div>
  )
}

// ── Profile spool list (loaded on expand) ─────────────────────

import { useProfile } from '../hooks/useFilament'

function ProfileSpoolList({
  profile,
  onWeigh,
  onSwap,
}: {
  profile: FilamentProfileWithCounts
  onWeigh: (s: SpoolWithRemaining) => void
  onSwap: (s: SpoolWithRemaining) => void
}) {
  const { data, isLoading } = useProfile(profile.id)

  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs text-ink-tertiary">Loading spools…</p>
      </div>
    )
  }

  const spools = data?.spools ?? []

  if (spools.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs text-ink-tertiary">No spools recorded for this profile.</p>
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-border">
      {/* Column headers */}
      <div className="flex items-center gap-3 mb-1 px-0">
        <div className="w-5 shrink-0" />
        <div className="w-16 shrink-0 text-[10px] text-ink-tertiary uppercase font-semibold tracking-wide">Status</div>
        <div className="w-32 shrink-0 text-[10px] text-ink-tertiary uppercase font-semibold tracking-wide">Remaining</div>
        <div className="flex-1 text-[10px] text-ink-tertiary uppercase font-semibold tracking-wide">Level</div>
        <div className="w-24 hidden sm:block" />
        <div className="w-6" />
        <div className="w-16" />
      </div>

      {spools.map((spool) => (
        <SpoolRow
          key={spool.id}
          spool={spool}
          emptySpoolWeight={profile.empty_spool_weight_g}
          onWeigh={onWeigh}
          onSwap={onSwap}
        />
      ))}
    </div>
  )
}

// ── Weigh modal ───────────────────────────────────────────────

interface WeighModalProps {
  spool: SpoolWithRemaining
  onClose: () => void
}

function WeighModal({ spool, onClose }: WeighModalProps) {
  const [grossWeight, setGrossWeight] = useState(
    spool.current_gross_weight_g?.toString() ?? ''
  )
  const [eventType, setEventType] = useState<'weigh' | 'pre_print' | 'post_print'>('weigh')
  const [slicerEst, setSlicerEst] = useState('')
  const [notes, setNotes] = useState('')

  const weighMutation = useWeighSpool(spool.id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const g = parseFloat(grossWeight)
    if (isNaN(g) || g < 0) return

    await weighMutation.mutateAsync({
      gross_weight_g: g,
      event_type: eventType,
      slicer_estimate_g: slicerEst ? parseFloat(slicerEst) : undefined,
      notes: notes || undefined,
    })
    onClose()
  }

  return (
    <Modal title="Log Weight" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">
            Gross weight (g) <span className="text-ink-tertiary font-normal">— scale reading</span>
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            required
            value={grossWeight}
            onChange={(e) => setGrossWeight(e.target.value)}
            className="input font-mono"
            placeholder="e.g. 850.0"
            autoFocus
          />
        </div>

        <div>
          <label className="label">Event type</label>
          <div className="flex gap-2">
            {(['weigh', 'pre_print', 'post_print'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEventType(t)}
                className={[
                  'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
                  eventType === t
                    ? 'bg-accent-subtle border-accent text-accent'
                    : 'bg-elevated border-border text-ink-secondary hover:border-border-strong',
                ].join(' ')}
              >
                {t === 'weigh' ? 'Weigh' : t === 'pre_print' ? 'Pre-print' : 'Post-print'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Slicer estimate (g) <span className="text-ink-tertiary font-normal">optional</span></label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={slicerEst}
            onChange={(e) => setSlicerEst(e.target.value)}
            className="input font-mono"
            placeholder="e.g. 45.0"
          />
        </div>

        <div>
          <label className="label">Notes <span className="text-ink-tertiary font-normal">optional</span></label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input"
            placeholder="e.g. before Benchy"
          />
        </div>

        {weighMutation.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(weighMutation.error as Error).message}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={weighMutation.isPending} className="btn-primary flex-1 justify-center">
            {weighMutation.isPending ? 'Saving…' : 'Log weight'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Swap modal ────────────────────────────────────────────────

interface SwapModalProps {
  spool: SpoolWithRemaining
  onClose: () => void
}

function SwapModal({ spool, onClose }: SwapModalProps) {
  const [finalWeight, setFinalWeight] = useState('')
  const [openingWeight, setOpeningWeight] = useState('')
  const swapMutation = useSwapSpool(spool.id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await swapMutation.mutateAsync({
      final_gross_weight_g:   finalWeight   ? parseFloat(finalWeight)   : undefined,
      opening_gross_weight_g: openingWeight ? parseFloat(openingWeight) : undefined,
    })
    onClose()
  }

  return (
    <Modal title="Spool Swap" onClose={onClose}>
      <div className="mb-4 p-3 rounded-md bg-info-bg border border-border text-xs text-info">
        <p className="font-semibold mb-1">What this does</p>
        <ol className="list-decimal list-inside space-y-0.5 text-ink-secondary">
          <li>Marks this spool <strong className="text-ink-primary">empty</strong></li>
          <li>Promotes the oldest reserve spool to <strong className="text-ink-primary">active</strong></li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">
            Final gross weight (g) <span className="text-ink-tertiary font-normal">optional</span>
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={finalWeight}
            onChange={(e) => setFinalWeight(e.target.value)}
            className="input font-mono"
            placeholder="Weigh the empty spool"
          />
        </div>

        <div>
          <label className="label">
            Opening weight of next spool (g) <span className="text-ink-tertiary font-normal">optional</span>
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={openingWeight}
            onChange={(e) => setOpeningWeight(e.target.value)}
            className="input font-mono"
            placeholder="Weigh the new spool"
          />
        </div>

        {swapMutation.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(swapMutation.error as Error).message}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={swapMutation.isPending} className="btn-primary flex-1 justify-center">
            {swapMutation.isPending ? 'Swapping…' : 'Confirm swap'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Add Profile modal ─────────────────────────────────────────

function AddProfileModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    brand: '', material: 'PLA', material_variant: '',
    color_name: '', color_hex: '#ffffff',
    net_spool_weight_g: '1000', cost_per_spool: '',
    empty_spool_weight_g: '',
  })

  const createProfile = useCreateProfile()

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createProfile.mutateAsync({
      brand: form.brand,
      material: form.material,
      material_variant: form.material_variant || undefined,
      color_name: form.color_name || undefined,
      color_hex: form.color_hex || undefined,
      net_spool_weight_g: form.net_spool_weight_g ? parseFloat(form.net_spool_weight_g) : undefined,
      cost_per_spool: form.cost_per_spool ? parseFloat(form.cost_per_spool) : undefined,
      empty_spool_weight_g: form.empty_spool_weight_g ? parseFloat(form.empty_spool_weight_g) : undefined,
    } as Parameters<typeof createProfile.mutateAsync>[0])
    onClose()
  }

  const MATERIALS = ['PLA', 'PLA+', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon', 'PC', 'Silk PLA', 'Matte PLA', 'PLA-CF', 'PETG-CF', 'Other']

  return (
    <Modal title="Add Filament Profile" onClose={onClose} width="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Brand</label>
            <input className="input" value={form.brand} onChange={(e) => set('brand', e.target.value)}
              required placeholder="e.g. Bambu Lab" />
          </div>

          <div>
            <label className="label">Material</label>
            <select className="input" value={form.material} onChange={(e) => set('material', e.target.value)}>
              {MATERIALS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Variant <span className="text-ink-tertiary">(optional)</span></label>
            <input className="input" value={form.material_variant} onChange={(e) => set('material_variant', e.target.value)}
              placeholder="e.g. Matte, Silk" />
          </div>

          <div>
            <label className="label">Color name</label>
            <input className="input" value={form.color_name} onChange={(e) => set('color_name', e.target.value)}
              placeholder="e.g. Galaxy Black" />
          </div>

          <div>
            <label className="label">Color hex</label>
            <div className="flex gap-2">
              <input type="color" value={form.color_hex}
                onChange={(e) => set('color_hex', e.target.value)}
                className="h-9 w-12 rounded-md border border-border bg-input cursor-pointer p-0.5"
              />
              <input className="input flex-1 font-mono" value={form.color_hex}
                onChange={(e) => set('color_hex', e.target.value)}
                placeholder="#ffffff" />
            </div>
          </div>

          <div>
            <label className="label">Net weight (g)</label>
            <input className="input font-mono" type="number" step="1" min="0"
              value={form.net_spool_weight_g} onChange={(e) => set('net_spool_weight_g', e.target.value)}
              placeholder="1000" />
          </div>

          <div>
            <label className="label">Empty spool weight (g)</label>
            <input className="input font-mono" type="number" step="0.1" min="0"
              value={form.empty_spool_weight_g} onChange={(e) => set('empty_spool_weight_g', e.target.value)}
              placeholder="e.g. 246" />
          </div>

          <div className="col-span-2">
            <label className="label">Cost per spool (USD) <span className="text-ink-tertiary">(optional)</span></label>
            <input className="input font-mono" type="number" step="0.01" min="0"
              value={form.cost_per_spool} onChange={(e) => set('cost_per_spool', e.target.value)}
              placeholder="e.g. 24.99" />
          </div>
        </div>

        {createProfile.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(createProfile.error as Error).message}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={createProfile.isPending} className="btn-primary flex-1 justify-center">
            {createProfile.isPending ? 'Saving…' : 'Add profile'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────

type ModalState =
  | { kind: 'weigh'; spool: SpoolWithRemaining }
  | { kind: 'swap';  spool: SpoolWithRemaining }
  | { kind: 'add-profile' }
  | null

export default function FilamentPage() {
  const { data: profiles = [], isLoading, error } = useProfiles()
  const [modal, setModal] = useState<ModalState>(null)
  const [filter, setFilter] = useState('')

  const filtered = profiles.filter((p) => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      p.brand.toLowerCase().includes(q) ||
      p.material.toLowerCase().includes(q) ||
      p.color_name?.toLowerCase().includes(q)
    )
  })

  // Summarise totals for the subtitle
  const totalActive  = profiles.reduce((acc, p) => acc + p.spool_counts.active, 0)
  const totalReserve = profiles.reduce((acc, p) => acc + p.spool_counts.reserve + p.spool_counts.partial_reserve, 0)

  return (
    <AppShell title="Filament">
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-ink-primary">Filament Inventory</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            {profiles.length} profiles · {totalActive} active · {totalReserve} reserve
          </p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ kind: 'add-profile' })}>
          <IconPlus size={15} />
          Add profile
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <input
          className="input max-w-xs"
          placeholder="Filter by brand, material, color…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* List */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card animate-pulse">
              <div className="h-8 bg-elevated rounded-md" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="alert-strip-critical rounded-lg">
          <IconAlertCircle size={14} className="inline mr-1" />
          Failed to load filament profiles: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-ink-secondary text-md font-medium">No filament profiles yet</p>
          <p className="text-ink-tertiary text-xs mt-1">
            Click <strong>Add profile</strong> to start tracking your spools.
          </p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              onWeigh={(spool) => setModal({ kind: 'weigh', spool })}
              onSwap={(spool) => setModal({ kind: 'swap', spool })}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.kind === 'add-profile' && (
        <AddProfileModal onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'weigh' && (
        <WeighModal spool={modal.spool} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'swap' && (
        <SwapModal spool={modal.spool} onClose={() => setModal(null)} />
      )}
    </AppShell>
  )
}
