import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconPlus,
  IconPackage,
  IconCircleCheck,
  IconX,
  IconAlertTriangle,
  IconPlayerPlay,
  IconCheck,
  IconTrash,
} from '@tabler/icons-react'
import AppShell from '../components/AppShell'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────

interface PrintKit {
  id: string
  name: string
  brand: string | null
  kits_owned: number
  kits_completed: number
  kits_in_progress: number
  project_url: string | null
  notes: string | null
}

interface KitComponent {
  component: {
    id: string
    kit_id: string
    component_type: string
    workshop_item_id: string | null
    filament_profile_id: string | null
    quantity_per_build: string
    filament_grams_per_build: string | null
    external_name: string | null
    external_buy_url: string | null
    notes: string | null
  }
  workshop_name: string | null
  workshop_qty: string | null
  workshop_unit: string | null
  filament_brand: string | null
  filament_material: string | null
  filament_color: string | null
}

interface ReadinessResult {
  can_build: boolean
  missing: Array<{ name: string; needed: number; have: number; unit: string }>
}

interface KitDetail {
  kit: PrintKit
  components: KitComponent[]
  readiness: ReadinessResult
}

// ── Hooks ─────────────────────────────────────────────────────

const KITS_KEY = ['kits'] as const

function useKits() {
  return useQuery({ queryKey: KITS_KEY, queryFn: () => api.get<PrintKit[]>('/kits') })
}

function useKitDetail(id: string) {
  return useQuery({
    queryKey: ['kit', id],
    queryFn: () => api.get<KitDetail>(`/kits/${id}`),
  })
}

function useCreateKit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/kits', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KITS_KEY }),
  })
}

function useBuildKit(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (action: 'start' | 'complete') =>
      api.post(`/kits/${id}/build`, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KITS_KEY })
      qc.invalidateQueries({ queryKey: ['kit', id] })
    },
  })
}

function useDeleteKit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/kits/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KITS_KEY }),
  })
}


// ── Component type badge ──────────────────────────────────────

function componentTypeBadge(type: string) {
  switch (type) {
    case 'filament':      return <Badge variant="accent">Filament</Badge>
    case 'workshop_item': return <Badge variant="info">Hardware</Badge>
    case 'external':      return <Badge variant="warning">External</Badge>
    default:              return <Badge>{type}</Badge>
  }
}

// ── Kit component row ─────────────────────────────────────────

function ComponentRow({ row, missing }: {
  row: KitComponent
  missing: ReadinessResult['missing']
}) {
  const c = row.component
  const name = c.component_type === 'filament'
    ? `${row.filament_brand ?? ''} ${row.filament_material ?? ''}`
    : c.component_type === 'workshop_item'
    ? row.workshop_name ?? c.external_name ?? '—'
    : c.external_name ?? '—'

  const qty = c.component_type === 'filament'
    ? `${c.filament_grams_per_build ?? c.quantity_per_build}g`
    : `${c.quantity_per_build} ${row.workshop_unit ?? 'pcs'}`

  const have = c.component_type === 'workshop_item'
    ? `${parseFloat(row.workshop_qty ?? '0').toFixed(0)} in stock`
    : null

  const isMissing = missing.some((m) => m.name.toLowerCase().includes(name.toLowerCase()))

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className="w-20 shrink-0">{componentTypeBadge(c.component_type)}</div>

      {/* Filament color swatch if applicable */}
      {c.component_type === 'filament' && row.filament_color && (
        <div
          className="w-5 h-5 rounded-full border-2 shrink-0"
          style={{ backgroundColor: row.filament_color, borderColor: '#2e3e58' }}
        />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-primary">{name}</p>
        {c.notes && <p className="text-xs text-ink-tertiary">{c.notes}</p>}
      </div>

      <div className="text-right shrink-0">
        <p className="text-xs font-mono text-ink-primary">{qty} needed</p>
        {have && <p className="text-[10px] text-ink-tertiary">{have}</p>}
      </div>

      <div className="w-5 shrink-0 flex justify-center">
        {isMissing
          ? <IconX size={14} className="text-danger" />
          : <IconCircleCheck size={14} className="text-success" />}
      </div>
    </div>
  )
}

// ── Kit card ──────────────────────────────────────────────────

function KitCard({ kit }: { kit: PrintKit }) {
  const [expanded, setExpanded] = useState(false)
  const deleteKit = useDeleteKit()
  const { data: detail, isLoading } = useKitDetail(expanded ? kit.id : '')
  const buildKit = useBuildKit(kit.id)

  const readiness = detail?.readiness
  const canBuild  = readiness?.can_build ?? false

  return (
    <div className="card">
      <div
        className="flex items-center gap-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-7 h-7 rounded-md bg-elevated flex items-center justify-center shrink-0">
          <IconPackage size={15} className="text-accent" stroke={1.5} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-md font-semibold text-ink-primary">{kit.name}</p>
          {kit.brand && <p className="text-xs text-ink-tertiary">{kit.brand}</p>}
        </div>

        {/* Counters */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-ink-secondary">
            {kit.kits_owned} owned · {kit.kits_completed} done · {kit.kits_in_progress} in progress
          </span>
          {expanded && readiness && (
            canBuild
              ? <Badge variant="success" icon={IconCircleCheck}>Ready</Badge>
              : <Badge variant="danger" icon={IconX}>Missing items</Badge>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border">
          {isLoading && <p className="text-xs text-ink-tertiary">Loading components…</p>}

          {detail && (
            <>
              {/* Readiness strip */}
              {!readiness?.can_build && readiness && readiness.missing.length > 0 && (
                <div className="mb-3 p-2.5 rounded-md bg-danger-bg border border-border text-xs text-danger">
                  <div className="flex items-center gap-1.5 font-semibold mb-1">
                    <IconAlertTriangle size={12} /> Missing items
                  </div>
                  {readiness.missing.map((m, i) => (
                    <p key={i} className="text-ink-secondary">
                      {m.name}: need <span className="font-mono">{m.needed}</span>{m.unit}, have <span className="font-mono text-danger">{m.have}</span>{m.unit}
                    </p>
                  ))}
                </div>
              )}

              {/* Components */}
              {detail.components.length > 0 ? (
                detail.components.map((row) => (
                  <ComponentRow
                    key={row.component.id}
                    row={row}
                    missing={readiness?.missing ?? []}
                  />
                ))
              ) : (
                <p className="text-xs text-ink-tertiary mb-3">No components added yet.</p>
              )}

              {/* Build actions */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                <button
                  className="btn-primary text-xs py-1.5"
                  disabled={!canBuild || buildKit.isPending}
                  onClick={() => buildKit.mutate('start')}
                >
                  <IconPlayerPlay size={13} /> Start build
                </button>
                {kit.kits_in_progress > 0 && (
                  <button
                    className="btn-secondary text-xs py-1.5"
                    disabled={buildKit.isPending}
                    onClick={() => buildKit.mutate('complete')}
                  >
                    <IconCheck size={13} /> Complete build
                  </button>
                )}
                <button
                  className="btn-icon ml-auto text-danger hover:bg-danger-bg"
                  title="Delete kit"
                  onClick={() => {
                    if (confirm(`Delete "${kit.name}"?`)) deleteKit.mutate(kit.id)
                  }}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add kit modal ─────────────────────────────────────────────

function AddKitModal({ onClose }: { onClose: () => void }) {
  const create = useCreateKit()
  const [form, setForm] = useState({ name: '', brand: '', kits_owned: '1', project_url: '' })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await create.mutateAsync({
      name: form.name,
      brand: form.brand || undefined,
      kits_owned: parseInt(form.kits_owned) || 0,
      project_url: form.project_url || undefined,
    })
    onClose()
  }

  return (
    <Modal title="Add Print Kit" onClose={onClose} width="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Kit name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)}
            required placeholder="e.g. Bambu Lamp Kit MH001" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Brand</label>
            <input className="input" value={form.brand} onChange={(e) => set('brand', e.target.value)}
              placeholder="e.g. Bambu Lab" />
          </div>
          <div>
            <label className="label">Kits owned</label>
            <input className="input font-mono" type="number" min="0" value={form.kits_owned}
              onChange={(e) => set('kits_owned', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Project URL <span className="text-ink-tertiary">(optional)</span></label>
          <input className="input" value={form.project_url} onChange={(e) => set('project_url', e.target.value)}
            placeholder="https://makerworld.com/…" />
        </div>
        {create.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(create.error as Error).message}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">
            {create.isPending ? 'Adding…' : 'Add kit'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function KitsPage() {
  const { data: kits = [], isLoading } = useKits()
  const [showAdd, setShowAdd] = useState(false)

  return (
    <AppShell title="Print Kits">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-ink-primary">Print Kits</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            {kits.length} kits · {kits.reduce((a, k) => a + k.kits_in_progress, 0)} in progress
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <IconPlus size={15} /> Add kit
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((n) => (
            <div key={n} className="card animate-pulse h-14 bg-elevated" />
          ))}
        </div>
      )}

      {!isLoading && kits.length === 0 && (
        <div className="card text-center py-12">
          <IconPackage size={32} className="text-ink-tertiary mx-auto mb-3" stroke={1} />
          <p className="text-ink-secondary text-md font-medium">No print kits yet</p>
          <p className="text-ink-tertiary text-xs mt-1">
            Track Bambu lamp kits, clock kits, LED bundles, and more.
          </p>
        </div>
      )}

      {!isLoading && kits.length > 0 && (
        <div className="space-y-2">
          {kits.map((kit) => <KitCard key={kit.id} kit={kit} />)}
        </div>
      )}

      {showAdd && <AddKitModal onClose={() => setShowAdd(false)} />}
    </AppShell>
  )
}
