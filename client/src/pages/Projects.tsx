import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconPlus, IconFile3d, IconTrash, IconExternalLink, IconChevronLeft,
  IconStack2, IconNut, IconClock, IconInfoCircle, IconAlertTriangle,
  IconCircleCheck, IconChevronDown, IconChevronRight, IconCash, IconX,
} from '@tabler/icons-react'
import AppShell from '../components/AppShell'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { api } from '../lib/api'
import { useProfiles } from '../hooks/useFilament'
import { usePrinters } from '../hooks/usePrinters'

// ── Types ─────────────────────────────────────────────────────

interface Project {
  id: string
  project_url: string | null
  platform: string
  status: string
  title: string | null
  designer: string | null
  printer_id: string | null
  assembly_time_min_per_unit: string | null
  units_produced: number
  venue: string
  event_date: string | null
  packaging_cost_per_unit: string | null
  table_fee: string | null
  platform_fee_pct: string | null
  target_price: string | null
  units_sold: number | null
  actual_revenue: string | null
  notes: string | null
}

interface PlateColor {
  id: string
  color_label: string | null
  filament_profile_id: string | null
  grams_used: string
  cost_per_gram: number
  filament_label: string | null
}
interface Plate {
  id: string
  plate_number: number
  plate_name: string | null
  print_time_min: string | null
  batch_quantity: number
  colors: PlateColor[]
}
interface Part {
  id: string
  workshop_item_id: string | null
  quantity_per_unit: string
  cost_per_unit: number
  item_name: string | null
  unit: string | null
  available: number
}
interface CostBreakdown {
  total_filament_cost: number
  parts_cost: number
  electricity_cost: number
  labor_cost: number
  total_project_cost: number
  cost_per_item: number
  total_print_time_min: number
}
interface Tiers {
  break_even: number; fair: number; market: number; suggested: number
  profit_at_suggested: number; margin_pct: number
}
interface Shortfall {
  kind: 'filament' | 'part'; label: string; needed: number; available: number; gap: number; unit: string
}
interface ProjectDetail {
  project: Project
  printerName: string | null
  plates: Plate[]
  parts: Part[]
  cost: CostBreakdown
  tiers: Tiers
  inventory: { can_fulfill: boolean; shortfalls: Shortfall[] }
  tips: string[]
}
interface ProjectListItem {
  project: Project
  printerName: string | null
  cost_per_item: number
  suggested_price: number
  has_selling_info: boolean
}

interface WorkshopItem { id: string; name: string; unit: string; quantity: string }

// ── Constants ─────────────────────────────────────────────────

const PLATFORMS = [
  { value: 'makerworld', label: 'MakerWorld' },
  { value: 'printables', label: 'Printables' },
  { value: 'thingiverse', label: 'Thingiverse' },
  { value: 'cults3d', label: 'Cults3D' },
  { value: 'other', label: 'Other' },
]
const STATUSES = [
  { value: 'want_to_print', label: 'Want to print' },
  { value: 'printing', label: 'Printing' },
  { value: 'completed', label: 'Completed' },
]
const VENUES = [
  { value: 'farmers_market', label: 'Farmers market' },
  { value: 'etsy', label: 'Etsy' },
  { value: 'local', label: 'Local sale' },
  { value: 'convention', label: 'Convention' },
  { value: 'other', label: 'Other' },
]

function platformBadge(p: string) {
  switch (p) {
    case 'makerworld': return <Badge variant="accent">MakerWorld</Badge>
    case 'printables': return <Badge variant="info">Printables</Badge>
    case 'thingiverse': return <Badge variant="default">Thingiverse</Badge>
    case 'cults3d': return <Badge variant="default">Cults3D</Badge>
    default: return <Badge>Other</Badge>
  }
}
function statusBadge(s: string) {
  switch (s) {
    case 'want_to_print': return <Badge variant="default">Want to print</Badge>
    case 'printing': return <Badge variant="accent">Printing</Badge>
    case 'completed': return <Badge variant="success">Completed</Badge>
    default: return <Badge>{s}</Badge>
  }
}

// ── Hooks ─────────────────────────────────────────────────────

const KEY = ['projects'] as const

function useProjects() {
  return useQuery({ queryKey: KEY, queryFn: () => api.get<ProjectListItem[]>('/projects') })
}
function useProjectDetail(id: string | null) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
  })
}
function useWorkshopItems() {
  return useQuery({ queryKey: ['workshop'], queryFn: () => api.get<WorkshopItem[]>('/workshop') })
}

// ── Project list view ─────────────────────────────────────────

function ProjectListView({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const { data: projects = [], isLoading } = useProjects()

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-ink-primary">Projects</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">{projects.length} projects</p>
        </div>
        <button className="btn-primary" onClick={onNew}>
          <IconPlus size={15} /> New project
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="card animate-pulse h-20 bg-elevated" />)}</div>
      )}

      {!isLoading && projects.length === 0 && (
        <div className="card text-center py-12">
          <IconFile3d size={32} className="text-ink-tertiary mx-auto mb-3" stroke={1} />
          <p className="text-ink-secondary text-md font-medium">No projects yet</p>
          <p className="text-ink-tertiary text-xs mt-1">
            Add a project to calculate print cost and set a sell price.
          </p>
        </div>
      )}

      {!isLoading && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.map((item) => (
            <button
              key={item.project.id}
              onClick={() => onOpen(item.project.id)}
              className="card text-left hover:border-border-strong transition-colors"
            >
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {platformBadge(item.project.platform)}
                {statusBadge(item.project.status)}
              </div>
              <p className="text-md font-semibold text-ink-primary truncate">
                {item.project.title ?? 'Untitled project'}
              </p>
              {item.project.designer && (
                <p className="text-xs text-ink-tertiary">by {item.project.designer}</p>
              )}
              {item.printerName && (
                <p className="text-[11px] text-ink-tertiary mt-1">Printing on {item.printerName}</p>
              )}
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xl font-mono font-bold text-ink-primary">
                  ${item.cost_per_item.toFixed(2)}
                </p>
                <p className="text-[10px] uppercase text-ink-tertiary font-semibold tracking-wider">
                  cost per item
                </p>
                {item.has_selling_info && item.suggested_price > 0 && (
                  <p className="text-xs text-accent mt-1 font-mono">
                    Suggested sell: ${item.suggested_price.toFixed(2)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// ── New project modal ─────────────────────────────────────────

function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    title: '', project_url: '', platform: 'makerworld', status: 'want_to_print', designer: '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Project>('/projects', data),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: KEY })
      onCreated(p.id)
    },
  })

  function handleUrl(url: string) {
    set('project_url', url)
    try {
      const host = new URL(url).hostname
      if (host.includes('makerworld')) set('platform', 'makerworld')
      else if (host.includes('printables')) set('platform', 'printables')
      else if (host.includes('thingiverse')) set('platform', 'thingiverse')
      else if (host.includes('cults3d')) set('platform', 'cults3d')
    } catch { /* ignore */ }
  }

  return (
    <Modal title="New Project" onClose={onClose} width="max-w-md">
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(form) }} className="space-y-4">
        <div>
          <label className="label">Title</label>
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)}
            required placeholder="e.g. Articulated Dragon" />
        </div>
        <div>
          <label className="label">Project URL <span className="text-ink-tertiary">(optional)</span></label>
          <input className="input" value={form.project_url} onChange={(e) => handleUrl(e.target.value)}
            placeholder="https://makerworld.com/models/…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Platform</label>
            <select className="input" value={form.platform} onChange={(e) => set('platform', e.target.value)}>
              {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Designer <span className="text-ink-tertiary">(optional)</span></label>
          <input className="input" value={form.designer} onChange={(e) => set('designer', e.target.value)} />
        </div>
        {create.error && <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">{(create.error as Error).message}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">
            {create.isPending ? 'Creating…' : 'Create project'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Debounced patch helper ────────────────────────────────────

function useProjectPatch(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch(`/projects/${projectId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

// A controlled input that commits to the server on blur.
function FieldInput({
  label, value, onCommit, type = 'text', placeholder, suffix, mono = true, width,
}: {
  label?: string; value: string; onCommit: (v: string) => void
  type?: string; placeholder?: string; suffix?: string; mono?: boolean; width?: string
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <div className={width}>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <input
          className={`input ${mono ? 'font-mono' : ''}`}
          type={type}
          value={local}
          placeholder={placeholder}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => { if (local !== value) onCommit(local) }}
          step={type === 'number' ? 'any' : undefined}
          min={type === 'number' ? '0' : undefined}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-tertiary pointer-events-none">{suffix}</span>}
      </div>
    </div>
  )
}

// ── Print time input (hours + minutes → total minutes) ───────

function PrintTimeInput({ totalMin, onCommit }: {
  totalMin: string | null
  onCommit: (totalMinutes: number | null) => void
}) {
  const initial = totalMin != null && totalMin !== '' ? parseFloat(totalMin) : null
  const [hours, setHours] = useState(initial != null ? Math.floor(initial / 60).toString() : '')
  const [mins, setMins] = useState(initial != null ? Math.round(initial % 60).toString() : '')

  // Re-sync when the server value changes (e.g. after refetch)
  useEffect(() => {
    const v = totalMin != null && totalMin !== '' ? parseFloat(totalMin) : null
    setHours(v != null ? Math.floor(v / 60).toString() : '')
    setMins(v != null ? Math.round(v % 60).toString() : '')
  }, [totalMin])

  function commit(h: string, m: string) {
    if (h === '' && m === '') { onCommit(null); return }
    const total = (parseInt(h) || 0) * 60 + (parseInt(m) || 0)
    if (total !== (initial ?? -1)) onCommit(total)
  }

  return (
    <div>
      <label className="label">Print time</label>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            className="input font-mono text-xs py-1.5 pr-6"
            type="number" min="0" step="1"
            value={hours}
            placeholder="0"
            onChange={(e) => setHours(e.target.value)}
            onBlur={() => commit(hours, mins)}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-tertiary">h</span>
        </div>
        <div className="relative flex-1">
          <input
            className="input font-mono text-xs py-1.5 pr-7"
            type="number" min="0" max="59" step="1"
            value={mins}
            placeholder="0"
            onChange={(e) => setMins(e.target.value)}
            onBlur={() => commit(hours, mins)}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-tertiary">m</span>
        </div>
      </div>
    </div>
  )
}

// ── Plates section ────────────────────────────────────────────

function PlatesSection({ projectId, plates }: { projectId: string; plates: Plate[] }) {
  const qc = useQueryClient()
  const { data: profiles = [] } = useProfiles()
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); qc.invalidateQueries({ queryKey: KEY }) }

  const addPlate = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/plates`, { plate_name: `Plate ${plates.length + 1}` }),
    onSuccess: invalidate,
  })
  const delPlate = useMutation({
    mutationFn: (plateId: string) => api.delete(`/projects/${projectId}/plates/${plateId}`),
    onSuccess: invalidate,
  })
  const patchPlate = useMutation({
    mutationFn: ({ plateId, data }: { plateId: string; data: Record<string, unknown> }) =>
      api.patch(`/projects/${projectId}/plates/${plateId}`, data),
    onSuccess: invalidate,
  })
  const addColor = useMutation({
    mutationFn: (plateId: string) => api.post(`/projects/${projectId}/plates/${plateId}/colors`, { grams_used: 0 }),
    onSuccess: invalidate,
  })
  const delColor = useMutation({
    mutationFn: ({ plateId, colorId }: { plateId: string; colorId: string }) =>
      api.delete(`/projects/${projectId}/plates/${plateId}/colors/${colorId}`),
    onSuccess: invalidate,
  })
  const patchColor = useMutation({
    mutationFn: ({ plateId, colorId, data }: { plateId: string; colorId: string; data: Record<string, unknown> }) =>
      api.patch(`/projects/${projectId}/plates/${plateId}/colors/${colorId}`, data),
    onSuccess: invalidate,
  })

  return (
    <div className="card">
      <SectionTitle icon={IconStack2} title="Plates & colors" />
      <div className="space-y-3">
        {plates.map((plate) => (
          <div key={plate.id} className="rounded-lg border border-border p-3 bg-elevated/40">
            <div className="flex items-center gap-2 mb-2">
              <FieldInput
                value={plate.plate_name ?? ''}
                mono={false}
                placeholder="Plate name (e.g. Body)"
                width="flex-1"
                onCommit={(v) => patchPlate.mutate({ plateId: plate.id, data: { plate_name: v } })}
              />
              <button className="btn-icon text-danger hover:bg-danger-bg" title="Remove plate"
                onClick={() => delPlate.mutate(plate.id)}>
                <IconTrash size={14} />
              </button>
            </div>

            {plate.colors.map((color) => (
              <div key={color.id} className="flex items-center gap-2 mb-1.5 pl-2">
                <input
                  className="input flex-1 text-xs py-1.5"
                  defaultValue={color.color_label ?? ''}
                  placeholder="Color label"
                  onBlur={(e) => {
                    if (e.target.value !== (color.color_label ?? ''))
                      patchColor.mutate({ plateId: plate.id, colorId: color.id, data: { color_label: e.target.value } })
                  }}
                />
                <select
                  className="input text-xs py-1.5"
                  style={{ width: '40%' }}
                  value={color.filament_profile_id ?? ''}
                  onChange={(e) => patchColor.mutate({ plateId: plate.id, colorId: color.id, data: { filament_profile_id: e.target.value || null } })}
                >
                  <option value="">Pick filament…</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.brand} {p.material}{p.color_name ? ` · ${p.color_name}` : ''}
                    </option>
                  ))}
                </select>
                <div className="relative w-24">
                  <input
                    className="input font-mono text-xs py-1.5 pr-7"
                    type="number" min="0" step="any"
                    defaultValue={color.grams_used}
                    onBlur={(e) => {
                      if (e.target.value !== color.grams_used)
                        patchColor.mutate({ plateId: plate.id, colorId: color.id, data: { grams_used: parseFloat(e.target.value) || 0 } })
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-tertiary">g</span>
                </div>
                <button className="btn-icon w-6 h-6 text-ink-tertiary hover:text-danger" title="Remove color"
                  onClick={() => delColor.mutate({ plateId: plate.id, colorId: color.id })}>
                  <IconX size={12} />
                </button>
              </div>
            ))}

            <button className="text-xs text-accent hover:underline mt-1 pl-2"
              onClick={() => addColor.mutate(plate.id)}>
              + Add color
            </button>

            {/* Print time + batch for this plate */}
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
              <PrintTimeInput
                totalMin={plate.print_time_min}
                onCommit={(total) => patchPlate.mutate({ plateId: plate.id, data: { print_time_min: total } })}
              />
              <div>
                <label className="label">Times run (batch)</label>
                <input
                  className="input font-mono text-xs py-1.5"
                  type="number" min="1" step="1"
                  defaultValue={plate.batch_quantity}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value) || 1
                    if (v !== plate.batch_quantity)
                      patchPlate.mutate({ plateId: plate.id, data: { batch_quantity: v } })
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        <button className="btn-secondary text-xs py-1.5" onClick={() => addPlate.mutate()}>
          <IconPlus size={13} /> Add plate
        </button>
      </div>
    </div>
  )
}

// ── Parts section ─────────────────────────────────────────────

function PartsSection({ projectId, parts }: { projectId: string; parts: Part[] }) {
  const qc = useQueryClient()
  const { data: items = [] } = useWorkshopItems()
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); qc.invalidateQueries({ queryKey: KEY }) }

  const addPart = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/parts`, { quantity_per_unit: 1 }),
    onSuccess: invalidate,
  })
  const delPart = useMutation({
    mutationFn: (partId: string) => api.delete(`/projects/${projectId}/parts/${partId}`),
    onSuccess: invalidate,
  })
  const patchPart = useMutation({
    mutationFn: ({ partId, data }: { partId: string; data: Record<string, unknown> }) =>
      api.patch(`/projects/${projectId}/parts/${partId}`, data),
    onSuccess: invalidate,
  })

  return (
    <div className="card">
      <SectionTitle icon={IconNut} title="Parts" />
      <div className="space-y-1.5">
        {parts.map((part) => (
          <div key={part.id} className="flex items-center gap-2">
            <select
              className="input flex-1 text-xs py-1.5"
              value={part.workshop_item_id ?? ''}
              onChange={(e) => patchPart.mutate({ partId: part.id, data: { workshop_item_id: e.target.value || null } })}
            >
              <option value="">Pick workshop item…</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <div className="relative w-28">
              <input
                className="input font-mono text-xs py-1.5 pr-12"
                type="number" min="0" step="any"
                defaultValue={part.quantity_per_unit}
                onBlur={(e) => {
                  if (e.target.value !== part.quantity_per_unit)
                    patchPart.mutate({ partId: part.id, data: { quantity_per_unit: parseFloat(e.target.value) || 0 } })
                }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-tertiary">/unit</span>
            </div>
            {part.cost_per_unit > 0 && (
              <span className="text-[10px] font-mono text-ink-tertiary w-16 text-right">${part.cost_per_unit.toFixed(2)}</span>
            )}
            <button className="btn-icon w-6 h-6 text-ink-tertiary hover:text-danger" onClick={() => delPart.mutate(part.id)}>
              <IconX size={12} />
            </button>
          </div>
        ))}
        <button className="text-xs text-accent hover:underline mt-1" onClick={() => addPart.mutate()}>
          + Add part
        </button>
        {parts.some((p) => p.workshop_item_id && p.cost_per_unit === 0) && (
          <p className="text-[10px] text-ink-tertiary mt-1">
            Parts with no cost have no purchase record yet — log a purchase to capture the price.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Cost panel ────────────────────────────────────────────────

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-ink-secondary">{label}</span>
      <span className="font-mono text-ink-secondary">${value.toFixed(2)}</span>
    </div>
  )
}

function CostPanel({ cost, unitsProduced, inventory }: {
  cost: CostBreakdown; unitsProduced: number; inventory: ProjectDetail['inventory']
}) {
  return (
    <div className="card sticky top-4">
      <div className="text-center pb-3 mb-3 border-b border-border">
        <p className="text-[10px] uppercase text-ink-tertiary font-semibold tracking-wider">Cost per item</p>
        <p className="text-2xl font-mono font-bold text-ink-primary mt-1">${cost.cost_per_item.toFixed(2)}</p>
        <p className="text-xs text-ink-tertiary mt-0.5">
          total project: <span className="font-mono text-ink-secondary">${cost.total_project_cost.toFixed(2)}</span>
          {unitsProduced > 1 && <span> ÷ {unitsProduced} items</span>}
        </p>
      </div>

      <div className="text-[10px] uppercase text-ink-tertiary font-semibold tracking-wider mb-1">
        Project totals
      </div>
      <CostRow label="Filament" value={cost.total_filament_cost} />
      <CostRow label="Parts" value={cost.parts_cost} />
      <CostRow label="Electricity" value={cost.electricity_cost} />
      <CostRow label="Labor" value={cost.labor_cost} />

      <div className="mt-2 pt-2 border-t border-border text-[11px] text-ink-tertiary">
        Total print time: <span className="font-mono">{(cost.total_print_time_min / 60).toFixed(1)} hrs</span>
      </div>

      {/* Inventory check */}
      {inventory.shortfalls.length > 0 ? (
        <div className="mt-3 p-2.5 rounded-md bg-danger-bg border border-border text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-danger mb-1">
            <IconAlertTriangle size={12} /> Not enough inventory
          </div>
          {inventory.shortfalls.map((s, i) => (
            <p key={i} className="text-ink-secondary">
              {s.label}: need <span className="font-mono">{s.needed}</span>{s.unit}, have <span className="font-mono text-danger">{s.available}</span>{s.unit}
            </p>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-success">
          <IconCircleCheck size={13} /> Enough inventory
        </div>
      )}
    </div>
  )
}

// ── Tier card ─────────────────────────────────────────────────

function TierCard({ label, price, desc, highlight }: { label: string; price: number; desc: string; highlight?: boolean }) {
  return (
    <div className={['rounded-lg p-3 border', highlight ? 'bg-accent-subtle border-accent' : 'bg-surface border-border'].join(' ')}>
      <p className="text-[10px] font-semibold uppercase text-ink-tertiary tracking-wider mb-1">{label}</p>
      <p className={['text-xl font-mono font-bold', highlight ? 'text-accent' : 'text-ink-primary'].join(' ')}>${price.toFixed(2)}</p>
      <p className="text-[11px] text-ink-secondary mt-1">{desc}</p>
    </div>
  )
}

// ── Selling section (collapsible) ─────────────────────────────

function SellingSection({ detail, patch }: { detail: ProjectDetail; patch: ReturnType<typeof useProjectPatch> }) {
  const { project, tiers, tips } = detail
  const [open, setOpen] = useState(
    project.target_price != null || project.units_sold != null || project.units_produced > 1,
  )
  const [showEvent, setShowEvent] = useState(false)

  return (
    <div className="card">
      <button className="w-full flex items-center gap-2 select-none" onClick={() => setOpen(!open)}>
        <IconCash size={15} className="text-accent" />
        <span className="text-md font-semibold text-ink-primary flex-1 text-left">Selling</span>
        {open ? <IconChevronDown size={16} className="text-ink-tertiary" /> : <IconChevronRight size={16} className="text-ink-tertiary" />}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {/* Tips */}
          {tips.length > 0 && (
            <div className="space-y-2">
              {tips.map((t, i) => (
                <div key={i} className="flex gap-2 p-2.5 rounded-md bg-warning-bg border border-border text-xs text-warning">
                  <IconInfoCircle size={13} className="shrink-0 mt-0.5" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          )}

          {/* Finished items produced — drives cost-per-item and pricing */}
          <div>
            <FieldInput label="Finished items produced" type="number" value={project.units_produced.toString()}
              width="max-w-xs"
              onCommit={(v) => patch.mutate({ units_produced: v })} />
            <p className="text-[11px] text-ink-tertiary mt-1">How many sellable items this whole project makes.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Venue</label>
              <select className="input" value={project.venue} onChange={(e) => patch.mutate({ venue: e.target.value })}>
                {VENUES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>
            <FieldInput label="Event date" type="date" mono={false} value={project.event_date ?? ''}
              onCommit={(v) => patch.mutate({ event_date: v })} />
            <FieldInput label="Packaging / item ($)" type="number" value={project.packaging_cost_per_unit ?? ''}
              onCommit={(v) => patch.mutate({ packaging_cost_per_unit: v })} />
            <FieldInput label="Table fee ($)" type="number" value={project.table_fee ?? ''}
              onCommit={(v) => patch.mutate({ table_fee: v })} />
            <FieldInput label="Platform fee (%)" type="number" value={project.platform_fee_pct ?? ''}
              onCommit={(v) => patch.mutate({ platform_fee_pct: v })} />
          </div>

          {/* Pricing tiers */}
          <div>
            <p className="text-[10px] font-semibold uppercase text-ink-tertiary tracking-wider mb-2">Pricing tiers</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <TierCard label="Break even" price={tiers.break_even} desc="Covers materials only" />
              <TierCard label="Fair" price={tiers.fair} desc="2× cost — covers time" />
              <TierCard label="Market" price={tiers.market} desc="3× cost — standard" />
              <TierCard label="Suggested" price={tiers.suggested} desc={`${tiers.margin_pct.toFixed(0)}% margin`} highlight />
            </div>
            <div className="flex items-center gap-3 mt-3 p-3 rounded-lg bg-elevated border border-border">
              <span className="text-xs text-ink-secondary shrink-0">Your sell price:</span>
              <div className="flex items-center gap-1">
                <span className="text-ink-secondary text-sm">$</span>
                <input className="input font-mono w-24 py-1" type="number" step="0.01" min="0"
                  defaultValue={project.target_price ? parseFloat(project.target_price).toFixed(2) : ''}
                  placeholder="0.00"
                  onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) patch.mutate({ target_price: v }) }}
                />
              </div>
              {project.target_price && (
                <span className="text-xs text-ink-secondary">
                  = ${(parseFloat(project.target_price) * project.units_produced).toFixed(2)} for {project.units_produced} item{project.units_produced > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Post-event */}
          <div className="pt-2 border-t border-border">
            {project.units_sold == null ? (
              <button className="btn-secondary text-xs py-1.5" onClick={() => setShowEvent(true)}>
                <IconCircleCheck size={13} /> Log sale results
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-elevated border border-border text-xs">
                <p className="font-semibold text-ink-secondary mb-1">Event results</p>
                <div className="flex gap-4">
                  <span>Sold: <span className="font-mono text-ink-primary">{project.units_sold}/{project.units_produced}</span></span>
                  {project.actual_revenue && (
                    <span>Revenue: <span className="font-mono text-success">${parseFloat(project.actual_revenue).toFixed(2)}</span></span>
                  )}
                </div>
              </div>
            )}
          </div>

          {showEvent && <PostEventModal project={project} onClose={() => setShowEvent(false)} />}
        </div>
      )}
    </div>
  )
}

function PostEventModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ units_sold: project.units_produced.toString(), actual_revenue: '' })
  const [result, setResult] = useState<{ sell_through_pct: number; actual_profit: number; advice: string } | null>(null)

  const complete = useMutation({
    mutationFn: () => api.post<{ sell_through_pct: number; actual_profit: number; advice: string }>(
      `/projects/${project.id}/complete`,
      { units_sold: parseInt(form.units_sold), actual_revenue: parseFloat(form.actual_revenue) },
    ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['project', project.id] })
      qc.invalidateQueries({ queryKey: KEY })
      setResult(res)
    },
  })

  if (result) {
    return (
      <Modal title="Event logged!" onClose={onClose} width="max-w-sm">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-elevated border border-border text-center">
              <p className="text-xl font-mono font-bold text-ink-primary">{result.sell_through_pct}%</p>
              <p className="text-[10px] uppercase text-ink-tertiary font-semibold tracking-wider mt-0.5">Sell-through</p>
            </div>
            <div className="p-3 rounded-lg bg-elevated border border-border text-center">
              <p className="text-xl font-mono font-bold text-success">${result.actual_profit.toFixed(2)}</p>
              <p className="text-[10px] uppercase text-ink-tertiary font-semibold tracking-wider mt-0.5">Profit</p>
            </div>
          </div>
          <div className="p-3 rounded-md bg-info-bg border border-border text-xs text-info">
            <IconInfoCircle size={12} className="inline mr-1" />{result.advice}
          </div>
          <button className="btn-primary w-full justify-center" onClick={onClose}>Done</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Log sale results" onClose={onClose} width="max-w-sm">
      <form onSubmit={(e) => { e.preventDefault(); complete.mutate() }} className="space-y-4">
        <div>
          <label className="label">Units sold (out of {project.units_produced})</label>
          <input className="input font-mono" type="number" min="0" max={project.units_produced}
            value={form.units_sold} onChange={(e) => setForm((f) => ({ ...f, units_sold: e.target.value }))} required />
        </div>
        <div>
          <label className="label">Actual revenue ($)</label>
          <input className="input font-mono" type="number" step="0.01" min="0"
            value={form.actual_revenue} onChange={(e) => setForm((f) => ({ ...f, actual_revenue: e.target.value }))} required placeholder="0.00" />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={complete.isPending} className="btn-primary flex-1 justify-center">
            {complete.isPending ? 'Logging…' : 'Log results'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Section title helper ──────────────────────────────────────

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={15} className="text-accent" stroke={1.75} />
      <span className="text-md font-semibold text-ink-primary">{title}</span>
    </div>
  )
}

// ── Project detail / editor view ──────────────────────────────

function ProjectDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: detail, isLoading } = useProjectDetail(id)
  const patch = useProjectPatch(id)
  const qc = useQueryClient()
  const { data: printers = [] } = usePrinters()

  const del = useMutation({
    mutationFn: () => api.delete(`/projects/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); onBack() },
  })

  const printerOptions = useMemo(() => printers.map((p) => ({
    id: p.id, name: p.nickname ?? `${p.brand} ${p.model}`,
  })), [printers])

  if (isLoading || !detail) {
    return (
      <div className="space-y-3">
        <div className="card animate-pulse h-12 bg-elevated" />
        <div className="card animate-pulse h-40 bg-elevated" />
      </div>
    )
  }

  const { project } = detail

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button className="btn-icon" onClick={onBack} title="Back to projects"><IconChevronLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <input
            className="text-lg font-bold text-ink-primary bg-transparent border-0 outline-none w-full p-0 focus:ring-0"
            defaultValue={project.title ?? ''}
            placeholder="Untitled project"
            onBlur={(e) => { if (e.target.value !== (project.title ?? '')) patch.mutate({ title: e.target.value }) }}
          />
          <div className="flex items-center gap-2 mt-0.5">
            {platformBadge(project.platform)}
            {statusBadge(project.status)}
          </div>
        </div>
        {project.project_url && (
          <a href={project.project_url} target="_blank" rel="noopener noreferrer" className="btn-icon" title="Open project page">
            <IconExternalLink size={16} />
          </a>
        )}
        <button className="btn-icon text-danger hover:bg-danger-bg" title="Delete project"
          onClick={() => { if (confirm(`Delete "${project.title ?? 'this project'}"?`)) del.mutate() }}>
          <IconTrash size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: form */}
        <div className="lg:col-span-2 space-y-4">
          {/* 1. Project info */}
          <div className="card">
            <SectionTitle icon={IconFile3d} title="Project info" />
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Project URL" mono={false} value={project.project_url ?? ''} width="col-span-2"
                onCommit={(v) => patch.mutate({ project_url: v })} placeholder="https://…" />
              <div>
                <label className="label">Platform</label>
                <select className="input" value={project.platform} onChange={(e) => patch.mutate({ platform: e.target.value })}>
                  {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={project.status} onChange={(e) => patch.mutate({ status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <FieldInput label="Designer" mono={false} value={project.designer ?? ''} width="col-span-2"
                onCommit={(v) => patch.mutate({ designer: v })} />
            </div>
          </div>

          {/* 2. Printer */}
          <div className="card">
            <SectionTitle icon={IconFile3d} title="Printer" />
            {printerOptions.length >= 2 ? (
              <select className="input" value={project.printer_id ?? ''}
                onChange={(e) => patch.mutate({ printer_id: e.target.value || null })}>
                <option value="">No printer selected</option>
                {printerOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <p className="text-sm text-ink-secondary">
                {detail.printerName ? <>Printing on: <span className="text-ink-primary font-medium">{detail.printerName}</span></> : 'No printer added yet.'}
              </p>
            )}
          </div>

          {/* 3. Plates (each plate carries its own print time + batch) */}
          <PlatesSection projectId={id} plates={detail.plates} />

          {/* 4. Parts */}
          <PartsSection projectId={id} parts={detail.parts} />

          {/* 5. Assembly (per finished item) */}
          <div className="card">
            <SectionTitle icon={IconClock} title="Assembly time" />
            <FieldInput label="Assembly time per item (min)" type="number"
              value={project.assembly_time_min_per_unit ?? ''} placeholder="e.g. 5"
              onCommit={(v) => patch.mutate({ assembly_time_min_per_unit: v })} />
          </div>
        </div>

        {/* Right: cost panel + selling */}
        <div className="space-y-4">
          <CostPanel cost={detail.cost} unitsProduced={project.units_produced} inventory={detail.inventory} />
        </div>

        {/* Selling spans full width below */}
        <div className="lg:col-span-3">
          <SellingSection detail={detail} patch={patch} />
        </div>
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <AppShell title="Projects">
      {openId ? (
        <ProjectDetailView id={openId} onBack={() => setOpenId(null)} />
      ) : (
        <ProjectListView onOpen={setOpenId} onNew={() => setShowNew(true)} />
      )}
      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => { setShowNew(false); setOpenId(id) }}
        />
      )}
    </AppShell>
  )
}
