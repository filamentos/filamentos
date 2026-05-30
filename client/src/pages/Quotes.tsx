import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconPlus,
  IconReceipt,
  IconInfoCircle,
  IconTrash,
  IconCheck,
  IconChevronRight,
  IconChevronDown,
} from '@tabler/icons-react'
import AppShell from '../components/AppShell'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────

interface Quote {
  id: string
  name: string
  batch_quantity: number
  print_time_min: string | null
  assembly_time_min: string | null
  packaging_cost: string | null
  table_fee: string | null
  selling_venue: string
  target_price: string | null
  status: string
  units_sold: number | null
  actual_revenue: string | null
  event_date: string | null
  notes: string | null
  created_at: string
}

interface LineItem {
  id: string
  quote_id: string
  item_type: string
  description: string
  qty_per_unit: string | null
  unit_label: string | null
  cost_per_unit_item: string | null
  line_cost_per_unit: string | null
  is_from_inventory: boolean | null
}

interface QuoteTotals {
  true_cost_per_unit: number
  total_batch_cost: number
  break_even: number
  fair_price: number
  market_price: number
  suggested_price: number
  profit_at_suggested: number
  margin_pct: number
}

interface QuoteDetail {
  quote: Quote
  lineItems: LineItem[]
  totals: QuoteTotals
  tips: string[]
}

// ── Hooks ─────────────────────────────────────────────────────

const QUOTES_KEY = ['quotes'] as const

function useQuotes() {
  return useQuery({ queryKey: QUOTES_KEY, queryFn: () => api.get<Quote[]>('/quotes') })
}

function useQuoteDetail(id: string) {
  return useQuery({
    queryKey: ['quote', id],
    queryFn: () => api.get<QuoteDetail>(`/quotes/${id}`),
    enabled: !!id,
  })
}

function useCreateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/quotes', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUOTES_KEY }),
  })
}

function useUpdateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/quotes/${id}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: QUOTES_KEY })
      qc.invalidateQueries({ queryKey: ['quote', v.id] })
    },
  })
}

function useDeleteQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/quotes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUOTES_KEY }),
  })
}

function useAddLineItem(quoteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post(`/quotes/${quoteId}/line-items`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote', quoteId] }),
  })
}

function useDeleteLineItem(quoteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lid: string) => api.delete(`/quotes/${quoteId}/line-items/${lid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote', quoteId] }),
  })
}

function useCompleteQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; units_sold: number; actual_revenue: number; notes?: string }) =>
      api.post(`/quotes/${id}/complete`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: QUOTES_KEY })
      qc.invalidateQueries({ queryKey: ['quote', v.id] })
    },
  })
}

// ── Status badge ──────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case 'draft':     return <Badge variant="default">Draft</Badge>
    case 'confirmed': return <Badge variant="info">Confirmed</Badge>
    case 'sold_out':  return <Badge variant="success">Sold out</Badge>
    case 'partial':   return <Badge variant="warning">Partial</Badge>
    case 'cancelled': return <Badge variant="danger">Cancelled</Badge>
    default:          return <Badge>{status}</Badge>
  }
}

// ── Pricing tier card ─────────────────────────────────────────

interface TierCardProps {
  label: string
  price: number
  description: string
  highlight?: boolean
}

function TierCard({ label, price, description, highlight = false }: TierCardProps) {
  return (
    <div className={[
      'rounded-lg p-3 border',
      highlight
        ? 'bg-accent-subtle border-accent'
        : 'bg-surface border-border',
    ].join(' ')}>
      <p className="text-[10px] font-semibold uppercase text-ink-tertiary tracking-wider mb-1">{label}</p>
      <p className={['text-xl font-mono font-bold', highlight ? 'text-accent' : 'text-ink-primary'].join(' ')}>
        ${price.toFixed(2)}
      </p>
      <p className="text-[11px] text-ink-secondary mt-1">{description}</p>
    </div>
  )
}

// ── Beginner tip ──────────────────────────────────────────────

function BeginnerTip({ tip }: { tip: string }) {
  return (
    <div className="flex gap-2 p-2.5 rounded-md bg-warning-bg border border-border text-xs text-warning">
      <IconInfoCircle size={13} className="shrink-0 mt-0.5" />
      <span>{tip}</span>
    </div>
  )
}

// ── Add line item modal ───────────────────────────────────────

function AddLineItemModal({ quoteId, onClose }: { quoteId: string; onClose: () => void }) {
  const add = useAddLineItem(quoteId)
  const [form, setForm] = useState({
    item_type: 'filament',
    description: '',
    qty_per_unit: '',
    unit_label: 'g',
    cost_per_unit_item: '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const lineCost = (parseFloat(form.qty_per_unit) || 0) * (parseFloat(form.cost_per_unit_item) || 0)

  const ITEM_TYPES = [
    { value: 'filament',     label: 'Filament' },
    { value: 'workshop_item', label: 'Workshop item' },
    { value: 'electricity',  label: 'Electricity' },
    { value: 'labor',        label: 'Labor' },
    { value: 'packaging',    label: 'Packaging' },
    { value: 'table_fee',    label: 'Table fee' },
    { value: 'wear',         label: 'Nozzle/plate wear' },
    { value: 'other',        label: 'Other' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await add.mutateAsync({
      item_type: form.item_type,
      description: form.description,
      qty_per_unit: parseFloat(form.qty_per_unit) || undefined,
      unit_label: form.unit_label || undefined,
      cost_per_unit_item: parseFloat(form.cost_per_unit_item) || undefined,
      line_cost_per_unit: lineCost,
      is_from_inventory: false,
    })
    onClose()
  }

  return (
    <Modal title="Add Cost Line Item" onClose={onClose} width="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.item_type} onChange={(e) => set('item_type', e.target.value)}>
              {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <input className="input" value={form.unit_label} onChange={(e) => set('unit_label', e.target.value)}
              placeholder="g, pcs, hrs, flat" />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={form.description} onChange={(e) => set('description', e.target.value)}
            required placeholder="e.g. Hatchbox Fire Red PLA · 18g per unit" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Qty per unit</label>
            <input className="input font-mono" type="number" step="any" min="0"
              value={form.qty_per_unit} onChange={(e) => set('qty_per_unit', e.target.value)}
              placeholder="18" />
          </div>
          <div>
            <label className="label">Cost per unit</label>
            <input className="input font-mono" type="number" step="0.0001" min="0"
              value={form.cost_per_unit_item} onChange={(e) => set('cost_per_unit_item', e.target.value)}
              placeholder="0.0150" />
          </div>
        </div>
        <div className="p-2.5 rounded-md bg-elevated border border-border">
          <span className="text-xs text-ink-secondary">Line cost per unit: </span>
          <span className="text-sm font-mono font-bold text-ink-primary">${lineCost.toFixed(4)}</span>
        </div>
        {add.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(add.error as Error).message}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={add.isPending} className="btn-primary flex-1 justify-center">
            {add.isPending ? 'Adding…' : 'Add line item'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Post-event logger modal ───────────────────────────────────

function PostEventModal({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const complete = useCompleteQuote()
  const [form, setForm] = useState({
    units_sold: quote.batch_quantity.toString(),
    actual_revenue: '',
    notes: '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const [result, setResult] = useState<{ sell_through_pct: number; actual_profit: number; advice: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const res = await complete.mutateAsync({
      id: quote.id,
      units_sold: parseInt(form.units_sold),
      actual_revenue: parseFloat(form.actual_revenue),
      notes: form.notes || undefined,
    }) as { sell_through_pct: number; actual_profit: number; advice: string }
    setResult(res)
  }

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
            <IconInfoCircle size={12} className="inline mr-1" />
            {result.advice}
          </div>
          <button className="btn-primary w-full justify-center" onClick={onClose}>Done</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Log sale results" onClose={onClose} width="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Units sold (out of {quote.batch_quantity})</label>
          <input className="input font-mono" type="number" min="0" max={quote.batch_quantity}
            value={form.units_sold} onChange={(e) => set('units_sold', e.target.value)} required />
        </div>
        <div>
          <label className="label">Actual revenue ($)</label>
          <input className="input font-mono" type="number" step="0.01" min="0"
            value={form.actual_revenue} onChange={(e) => set('actual_revenue', e.target.value)} required
            placeholder="0.00" />
        </div>
        <div>
          <label className="label">Notes <span className="text-ink-tertiary">(optional)</span></label>
          <input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)}
            placeholder="e.g. Sold out by noon" />
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

// ── Quote detail expanded ─────────────────────────────────────

function QuoteDetail({ quoteId }: { quoteId: string }) {
  const { data, isLoading } = useQuoteDetail(quoteId)
  const deleteItem = useDeleteLineItem(quoteId)
  const [showAddItem, setShowAddItem] = useState(false)
  const [showPostEvent, setShowPostEvent] = useState(false)
  const updateQuote = useUpdateQuote()

  if (isLoading) return <p className="text-xs text-ink-tertiary mt-3 pt-3 border-t border-border">Loading…</p>
  if (!data) return null

  const { quote, lineItems, totals, tips } = data

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-4">
      {/* Beginner tips */}
      {tips.length > 0 && (
        <div className="space-y-2">
          {tips.map((t, i) => <BeginnerTip key={i} tip={t} />)}
        </div>
      )}

      {/* Cost breakdown */}
      <div>
        <p className="text-[10px] font-semibold uppercase text-ink-tertiary tracking-wider mb-2">Cost breakdown</p>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-elevated">
                <th className="text-left px-3 py-2 text-ink-tertiary font-semibold">Description</th>
                <th className="text-right px-3 py-2 text-ink-tertiary font-semibold">Qty/unit</th>
                <th className="text-right px-3 py-2 text-ink-tertiary font-semibold">Rate</th>
                <th className="text-right px-3 py-2 text-ink-tertiary font-semibold">Cost/unit</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li) => (
                <tr key={li.id} className="border-t border-border hover:bg-elevated/50 transition-colors">
                  <td className="px-3 py-2 text-ink-primary">{li.description}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-secondary">
                    {li.qty_per_unit ? `${parseFloat(li.qty_per_unit).toFixed(3)} ${li.unit_label ?? ''}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-secondary">
                    {li.cost_per_unit_item ? `$${parseFloat(li.cost_per_unit_item).toFixed(4)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-primary font-semibold">
                    ${parseFloat(li.line_cost_per_unit ?? '0').toFixed(4)}
                  </td>
                  <td className="px-1 py-2">
                    <button
                      className="btn-icon w-6 h-6 text-danger hover:bg-danger-bg opacity-50 hover:opacity-100"
                      onClick={() => deleteItem.mutate(li.id)}
                    >
                      <IconTrash size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {lineItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-ink-tertiary">
                    No cost items yet. Add filament, hardware, labor, electricity…
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-border-strong bg-elevated">
                <td colSpan={3} className="px-3 py-2 text-ink-secondary font-semibold">True cost per unit</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-ink-primary">
                  ${totals.true_cost_per_unit.toFixed(4)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <button className="btn-secondary text-xs mt-2 py-1.5" onClick={() => setShowAddItem(true)}>
          <IconPlus size={12} /> Add cost item
        </button>
      </div>

      {/* Pricing tiers */}
      {lineItems.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase text-ink-tertiary tracking-wider mb-2">Pricing tiers</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <TierCard
              label="Break even"
              price={totals.break_even}
              description="Covers materials only — no profit"
            />
            <TierCard
              label="Fair price"
              price={totals.fair_price}
              description="2× cost — covers time at minimum"
            />
            <TierCard
              label="Market"
              price={totals.market_price}
              description="3× cost — standard maker pricing"
            />
            <TierCard
              label="Suggested"
              price={totals.suggested_price}
              description={`${totals.margin_pct.toFixed(0)}% margin — rounded clean price`}
              highlight
            />
          </div>

          {/* Sell price input */}
          <div className="flex items-center gap-3 mt-3 p-3 rounded-lg bg-elevated border border-border">
            <span className="text-xs text-ink-secondary shrink-0">Your sell price:</span>
            <div className="flex items-center gap-1">
              <span className="text-ink-secondary text-sm">$</span>
              <input
                className="input font-mono w-24 py-1"
                type="number"
                step="0.01"
                min="0"
                defaultValue={quote.target_price ? parseFloat(quote.target_price).toFixed(2) : ''}
                placeholder="0.00"
                onBlur={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!isNaN(v)) updateQuote.mutate({ id: quote.id, data: { target_price: v } })
                }}
              />
            </div>
            {quote.target_price && (
              <span className="text-xs text-ink-secondary">
                = ${(parseFloat(quote.target_price) * quote.batch_quantity).toFixed(2)} total for batch of {quote.batch_quantity}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Post-event logger */}
      {quote.status !== 'sold_out' && quote.status !== 'cancelled' && (
        <div className="pt-2 border-t border-border">
          <button
            className="btn-secondary text-xs py-1.5"
            onClick={() => setShowPostEvent(true)}
          >
            <IconCheck size={13} /> Log sale results
          </button>
        </div>
      )}

      {/* Post-event results */}
      {(quote.units_sold != null || quote.actual_revenue != null) && (
        <div className="p-3 rounded-lg bg-elevated border border-border text-xs">
          <p className="font-semibold text-ink-secondary mb-1">Event results</p>
          <div className="flex gap-4">
            <span>Sold: <span className="font-mono text-ink-primary">{quote.units_sold}/{quote.batch_quantity}</span></span>
            {quote.actual_revenue && (
              <span>Revenue: <span className="font-mono text-success">${parseFloat(quote.actual_revenue).toFixed(2)}</span></span>
            )}
          </div>
        </div>
      )}

      {showAddItem && <AddLineItemModal quoteId={quoteId} onClose={() => setShowAddItem(false)} />}
      {showPostEvent && <PostEventModal quote={quote} onClose={() => setShowPostEvent(false)} />}
    </div>
  )
}

// ── Quote card ────────────────────────────────────────────────

function QuoteCard({ quote }: { quote: Quote }) {
  const [expanded, setExpanded] = useState(false)
  const deleteQuote = useDeleteQuote()

  return (
    <div className="card">
      <div
        className="flex items-center gap-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-ink-tertiary shrink-0">
          {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        </button>

        <div className="w-7 h-7 rounded-md bg-elevated flex items-center justify-center shrink-0">
          <IconReceipt size={15} className="text-accent" stroke={1.5} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-md font-semibold text-ink-primary">{quote.name}</p>
          <p className="text-xs text-ink-tertiary">
            Batch of <span className="font-mono">{quote.batch_quantity}</span>
            {quote.event_date && ` · ${new Date(quote.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {quote.target_price && (
            <span className="text-sm font-mono text-ink-primary">${parseFloat(quote.target_price).toFixed(2)}</span>
          )}
          {statusBadge(quote.status)}
          <button
            className="btn-icon text-danger hover:bg-danger-bg"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`Delete "${quote.name}"?`)) deleteQuote.mutate(quote.id)
            }}
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>

      {expanded && <QuoteDetail quoteId={quote.id} />}
    </div>
  )
}

// ── New quote modal ───────────────────────────────────────────

const VENUES = [
  { value: 'farmers_market', label: 'Farmers market' },
  { value: 'etsy',           label: 'Etsy' },
  { value: 'local',          label: 'Local sale' },
  { value: 'convention',     label: 'Convention' },
  { value: 'other',          label: 'Other' },
]

function NewQuoteModal({ onClose }: { onClose: () => void }) {
  const create = useCreateQuote()
  const [form, setForm] = useState({
    name: '',
    batch_quantity: '1',
    print_time_min: '',
    assembly_time_min: '',
    table_fee: '0',
    selling_venue: 'farmers_market',
    event_date: '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await create.mutateAsync({
      name: form.name,
      batch_quantity: parseInt(form.batch_quantity) || 1,
      print_time_min: form.print_time_min ? parseFloat(form.print_time_min) : undefined,
      assembly_time_min: form.assembly_time_min ? parseFloat(form.assembly_time_min) : undefined,
      table_fee: form.table_fee ? parseFloat(form.table_fee) : undefined,
      selling_venue: form.selling_venue,
      event_date: form.event_date || undefined,
    })
    onClose()
  }

  return (
    <Modal title="New Quote" onClose={onClose} width="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Quote name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)}
            required placeholder="e.g. Dumpster Fire — Farmers Market Jun 2025" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Batch quantity</label>
            <input className="input font-mono" type="number" min="1" value={form.batch_quantity}
              onChange={(e) => set('batch_quantity', e.target.value)} required />
          </div>
          <div>
            <label className="label">Venue</label>
            <select className="input" value={form.selling_venue} onChange={(e) => set('selling_venue', e.target.value)}>
              {VENUES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Print time (min/unit)</label>
            <input className="input font-mono" type="number" step="1" min="0"
              value={form.print_time_min} onChange={(e) => set('print_time_min', e.target.value)}
              placeholder="e.g. 45" />
          </div>
          <div>
            <label className="label">Assembly time (min/unit)</label>
            <input className="input font-mono" type="number" step="1" min="0"
              value={form.assembly_time_min} onChange={(e) => set('assembly_time_min', e.target.value)}
              placeholder="e.g. 5" />
          </div>
          <div>
            <label className="label">Table fee ($)</label>
            <input className="input font-mono" type="number" step="0.01" min="0"
              value={form.table_fee} onChange={(e) => set('table_fee', e.target.value)}
              placeholder="0.00" />
          </div>
          <div>
            <label className="label">Event date <span className="text-ink-tertiary">(opt.)</span></label>
            <input className="input" type="date" value={form.event_date}
              onChange={(e) => set('event_date', e.target.value)} />
          </div>
        </div>
        {create.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(create.error as Error).message}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">
            {create.isPending ? 'Creating…' : 'Create quote'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function QuotesPage() {
  const { data: quotes = [], isLoading } = useQuotes()
  const [showNew, setShowNew] = useState(false)

  const drafts = quotes.filter((q) => q.status === 'draft').length
  const confirmed = quotes.filter((q) => q.status === 'confirmed').length

  return (
    <AppShell title="Quotes">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-ink-primary">Quotes</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            {drafts} draft · {confirmed} confirmed
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <IconPlus size={15} /> New quote
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((n) => <div key={n} className="card animate-pulse h-14 bg-elevated" />)}
        </div>
      )}

      {!isLoading && quotes.length === 0 && (
        <div className="card text-center py-12">
          <IconReceipt size={32} className="text-ink-tertiary mx-auto mb-3" stroke={1} />
          <p className="text-ink-secondary text-md font-medium">No quotes yet</p>
          <p className="text-ink-tertiary text-xs mt-1">
            Build a quote to calculate your true production cost and set a fair sell price.
          </p>
        </div>
      )}

      {!isLoading && quotes.length > 0 && (
        <div className="space-y-2">
          {quotes.map((q) => <QuoteCard key={q.id} quote={q} />)}
        </div>
      )}

      {showNew && <NewQuoteModal onClose={() => setShowNew(false)} />}
    </AppShell>
  )
}
