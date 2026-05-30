import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconPlus,
  IconTool,
  IconAlertTriangle,
  IconMinus,
} from '@tabler/icons-react'
import AppShell from '../components/AppShell'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────

interface WorkshopItem {
  id: string
  category: string
  name: string
  spec: Record<string, string | number> | null
  unit: string
  quantity: string
  low_stock_threshold: string
  reorder_url: string | null
  storage_location: string | null
  notes: string | null
}

// ── Hooks ─────────────────────────────────────────────────────

const WORKSHOP_KEY = ['workshop'] as const

function useWorkshop() {
  return useQuery({
    queryKey: WORKSHOP_KEY,
    queryFn: () => api.get<WorkshopItem[]>('/workshop'),
  })
}

function useUpdateWorkshop() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<WorkshopItem>(`/workshop/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKSHOP_KEY }),
  })
}

function useCreateWorkshop() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<WorkshopItem>('/workshop', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKSHOP_KEY }),
  })
}

function useDeleteWorkshop() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workshop/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKSHOP_KEY }),
  })
}

// ── Category config ───────────────────────────────────────────

const CATEGORIES = [
  { key: 'all',              label: 'All' },
  { key: 'fastener',        label: 'Fasteners' },
  { key: 'tool_durable',    label: 'Tools' },
  { key: 'tool_consumable', label: 'Consumables' },
  { key: 'hardware',        label: 'Hardware' },
  { key: 'electronic',      label: 'Electronics' },
  { key: 'other',           label: 'Other' },
]

// ── Item row ──────────────────────────────────────────────────

interface ItemRowProps {
  item: WorkshopItem
}

function ItemRow({ item }: ItemRowProps) {
  const update = useUpdateWorkshop()
  const del    = useDeleteWorkshop()

  const qty       = parseFloat(item.quantity)
  const threshold = parseFloat(item.low_stock_threshold)
  const isLow     = qty <= threshold
  const isEmpty   = qty === 0

  function adjustQty(delta: number) {
    const next = Math.max(0, qty + delta)
    update.mutate({ id: item.id, data: { quantity: next } })
  }

  const specStr = item.spec
    ? Object.entries(item.spec)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ')
    : null

  return (
    <div className={[
      'flex items-center gap-3 py-2.5 border-b border-border last:border-0 group',
      isEmpty ? 'opacity-60' : '',
    ].join(' ')}>
      {/* Low stock indicator */}
      <div className="w-1.5 shrink-0">
        {isEmpty && <div className="w-1.5 h-1.5 rounded-full bg-danger" />}
        {!isEmpty && isLow && <div className="w-1.5 h-1.5 rounded-full bg-warning" />}
      </div>

      {/* Name + spec */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-primary truncate">{item.name}</p>
        {specStr && <p className="text-[11px] text-ink-tertiary">{specStr}</p>}
        {item.storage_location && (
          <p className="text-[11px] text-ink-tertiary">{item.storage_location}</p>
        )}
      </div>

      {/* Stock badge */}
      <div className="shrink-0">
        {isEmpty ? (
          <Badge variant="danger">Out</Badge>
        ) : isLow ? (
          <Badge variant="warning">
            <IconAlertTriangle size={9} /> Low
          </Badge>
        ) : null}
      </div>

      {/* +/- controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => adjustQty(-1)}
          disabled={qty === 0 || update.isPending}
          className="w-6 h-6 rounded bg-elevated text-ink-secondary hover:bg-border-strong hover:text-ink-primary transition-colors disabled:opacity-30 flex items-center justify-center"
        >
          <IconMinus size={11} />
        </button>
        <span className="w-10 text-center font-mono text-sm text-ink-primary">
          {qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(1)} {item.unit}
        </span>
        <button
          onClick={() => adjustQty(1)}
          disabled={update.isPending}
          className="w-6 h-6 rounded bg-elevated text-ink-secondary hover:bg-border-strong hover:text-ink-primary transition-colors flex items-center justify-center"
        >
          <IconPlus size={11} />
        </button>
      </div>

      {/* Delete — hover only */}
      <button
        onClick={() => del.mutate(item.id)}
        className="opacity-0 group-hover:opacity-100 text-[11px] text-ink-tertiary hover:text-danger transition-all px-1"
        title="Delete"
      >
        ✕
      </button>
    </div>
  )
}

// ── Add item modal ────────────────────────────────────────────

function AddItemModal({ onClose }: { onClose: () => void }) {
  const create = useCreateWorkshop()
  const [form, setForm] = useState({
    category: 'fastener', name: '', unit: 'pcs',
    quantity: '0', low_stock_threshold: '5',
    storage_location: '', reorder_url: '',
    spec_size: '', spec_material: '',
  })

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const spec: Record<string, string> = {}
    if (form.spec_size)     spec['size'] = form.spec_size
    if (form.spec_material) spec['material'] = form.spec_material

    await create.mutateAsync({
      category:            form.category,
      name:                form.name,
      unit:                form.unit,
      quantity:            parseFloat(form.quantity),
      low_stock_threshold: parseFloat(form.low_stock_threshold),
      storage_location:    form.storage_location || undefined,
      reorder_url:         form.reorder_url || undefined,
      spec:                Object.keys(spec).length ? spec : undefined,
    })
    onClose()
  }

  const UNITS = ['pcs', 'set', 'roll', 'sheet', 'g', 'ml', 'm']

  return (
    <Modal title="Add Workshop Item" onClose={onClose} width="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <select className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="label">Name</label>
            <input required className="input" value={form.name}
              onChange={(e) => set('name', e.target.value)} placeholder="e.g. M3 socket head screws" />
          </div>

          {form.category === 'fastener' && (
            <>
              <div>
                <label className="label">Size</label>
                <input className="input font-mono" value={form.spec_size}
                  onChange={(e) => set('spec_size', e.target.value)} placeholder="M3x8" />
              </div>
              <div>
                <label className="label">Material</label>
                <input className="input" value={form.spec_material}
                  onChange={(e) => set('spec_material', e.target.value)} placeholder="stainless" />
              </div>
            </>
          )}

          <div>
            <label className="label">Qty on hand</label>
            <input className="input font-mono" type="number" step="1" min="0"
              value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </div>
          <div>
            <label className="label">Low-stock alert at</label>
            <input className="input font-mono" type="number" step="1" min="0"
              value={form.low_stock_threshold} onChange={(e) => set('low_stock_threshold', e.target.value)} />
          </div>

          <div>
            <label className="label">Storage location <span className="text-ink-tertiary">(optional)</span></label>
            <input className="input" value={form.storage_location}
              onChange={(e) => set('storage_location', e.target.value)} placeholder="Drawer A3" />
          </div>
          <div>
            <label className="label">Reorder URL <span className="text-ink-tertiary">(optional)</span></label>
            <input className="input" value={form.reorder_url}
              onChange={(e) => set('reorder_url', e.target.value)} placeholder="https://..." />
          </div>
        </div>

        {create.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(create.error as Error).message}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">
            {create.isPending ? 'Adding…' : 'Add item'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function WorkshopPage() {
  const { data: items = [], isLoading } = useWorkshop()
  const [activeTab, setActiveTab] = useState('all')
  const [showAdd, setShowAdd]     = useState(false)
  const [filter, setFilter]       = useState('')

  const filtered = useMemo(() => {
    let list = items
    if (activeTab !== 'all') list = list.filter((i) => i.category === activeTab)
    if (filter) {
      const q = filter.toLowerCase()
      list = list.filter((i) => i.name.toLowerCase().includes(q))
    }
    return list
  }, [items, activeTab, filter])

  const lowCount = items.filter((i) => parseFloat(i.quantity) <= parseFloat(i.low_stock_threshold)).length

  return (
    <AppShell title="Workshop">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-ink-primary">Workshop</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            {items.length} items
            {lowCount > 0 && (
              <span className="text-warning ml-1">
                · <IconAlertTriangle size={10} className="inline" /> {lowCount} low stock
              </span>
            )}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <IconPlus size={15} /> Add item
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {CATEGORIES.map((cat) => {
          const count = cat.key === 'all'
            ? items.length
            : items.filter((i) => i.category === cat.key).length
          if (count === 0 && cat.key !== 'all') return null
          return (
            <button
              key={cat.key}
              onClick={() => setActiveTab(cat.key)}
              className={[
                'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
                activeTab === cat.key
                  ? 'bg-accent-subtle border-accent text-accent'
                  : 'bg-elevated border-border text-ink-secondary hover:border-border-strong',
              ].join(' ')}
            >
              {cat.label}
              {count > 0 && <span className="ml-1 text-ink-tertiary">({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input className="input max-w-xs" placeholder="Filter items…"
          value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {/* List */}
      {isLoading && (
        <div className="card animate-pulse">
          <div className="h-32 bg-elevated rounded-md" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="card text-center py-10">
          <IconTool size={28} className="text-ink-tertiary mx-auto mb-2" stroke={1} />
          <p className="text-ink-secondary text-md font-medium">
            {items.length === 0 ? 'No workshop items yet' : 'No items match filter'}
          </p>
          {items.length === 0 && (
            <p className="text-ink-tertiary text-xs mt-1">
              Add fasteners, tools, and consumables to track what's in stock.
            </p>
          )}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="card">
          {filtered.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </div>
      )}

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} />}
    </AppShell>
  )
}
