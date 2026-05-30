import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconPlus,
  IconShoppingCart,
  IconTag,
} from '@tabler/icons-react'
import AppShell from '../components/AppShell'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────

interface PurchaseRecord {
  record: {
    id: string
    item_type: string
    item_ref_id: string | null
    purchase_date: string
    quantity: number | null
    price_per_unit: string | null
    total_paid: string | null
    currency: string | null
    product_title: string | null
    product_url: string | null
    order_id: string | null
    was_on_sale: boolean | null
    is_secondhand: boolean | null
    notes: string | null
  }
  source_name: string | null
  source_domain: string | null
}

// ── Hooks ─────────────────────────────────────────────────────

const PURCHASE_KEY = ['purchases'] as const

function usePurchases() {
  return useQuery({
    queryKey: PURCHASE_KEY,
    queryFn: () => api.get<PurchaseRecord[]>('/purchases'),
  })
}

function useCreatePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/purchases', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PURCHASE_KEY }),
  })
}

// ── Item type config ──────────────────────────────────────────

const ITEM_TYPES = [
  { value: 'all',           label: 'All' },
  { value: 'filament_spool', label: 'Filament' },
  { value: 'printer_part',   label: 'Parts' },
  { value: 'printer',        label: 'Printers' },
  { value: 'workshop_item',  label: 'Workshop' },
  { value: 'print_kit',      label: 'Kits' },
]

function itemTypeBadge(type: string) {
  switch (type) {
    case 'filament_spool': return <Badge variant="accent">Filament</Badge>
    case 'printer_part':   return <Badge variant="info">Part</Badge>
    case 'printer':        return <Badge variant="success">Printer</Badge>
    case 'workshop_item':  return <Badge variant="default">Workshop</Badge>
    case 'print_kit':      return <Badge variant="warning">Kit</Badge>
    default:               return <Badge>{type}</Badge>
  }
}

// ── Purchase entry row ────────────────────────────────────────

function PurchaseRow({ entry }: { entry: PurchaseRecord }) {
  const { record: r, source_name } = entry

  const priceDisplay = r.total_paid
    ? `${r.currency ?? 'USD'} ${parseFloat(r.total_paid).toFixed(2)}`
    : r.price_per_unit
    ? `${r.currency ?? 'USD'} ${parseFloat(r.price_per_unit).toFixed(2)} × ${r.quantity ?? 1}`
    : null

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      {/* Date */}
      <div className="w-16 shrink-0 text-center">
        <p className="text-[11px] font-mono text-ink-tertiary">
          {new Date(r.purchase_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
        <p className="text-[10px] text-ink-tertiary">
          {new Date(r.purchase_date).getFullYear()}
        </p>
      </div>

      {/* Type badge */}
      <div className="mt-0.5 shrink-0">
        {itemTypeBadge(r.item_type)}
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-primary">
          {r.product_title ?? r.item_type}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          {source_name && (
            <span className="text-[11px] text-ink-tertiary">{source_name}</span>
          )}
          {r.order_id && (
            <span className="text-[11px] text-ink-tertiary">#{r.order_id}</span>
          )}
          {r.was_on_sale && (
            <span className="text-[11px] text-success flex items-center gap-0.5">
              <IconTag size={9} /> Sale
            </span>
          )}
          {r.is_secondhand && (
            <span className="text-[11px] text-warning">Secondhand</span>
          )}
        </div>
      </div>

      {/* Price */}
      {priceDisplay && (
        <div className="shrink-0 text-right">
          <p className="text-sm font-mono text-ink-primary">{priceDisplay}</p>
          {r.quantity && r.quantity > 1 && r.price_per_unit && (
            <p className="text-[10px] text-ink-tertiary">
              {r.currency} {parseFloat(r.price_per_unit).toFixed(2)} each
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add purchase modal ────────────────────────────────────────

function AddPurchaseModal({ onClose }: { onClose: () => void }) {
  const create = useCreatePurchase()
  const [form, setForm] = useState({
    item_type: 'filament_spool',
    product_title: '',
    purchase_date: new Date().toISOString().split('T')[0],
    quantity: '1',
    price_per_unit: '',
    total_paid: '',
    currency: 'USD',
    order_id: '',
    was_on_sale: false,
    is_secondhand: false,
    notes: '',
  })

  function set(key: string, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await create.mutateAsync({
      item_type:      form.item_type,
      product_title:  form.product_title || undefined,
      purchase_date:  form.purchase_date,
      quantity:       parseInt(form.quantity),
      price_per_unit: form.price_per_unit ? parseFloat(form.price_per_unit) : undefined,
      total_paid:     form.total_paid ? parseFloat(form.total_paid) : undefined,
      currency:       form.currency,
      order_id:       form.order_id || undefined,
      was_on_sale:    form.was_on_sale,
      is_secondhand:  form.is_secondhand,
      notes:          form.notes || undefined,
    })
    onClose()
  }

  return (
    <Modal title="Log Purchase" onClose={onClose} width="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.item_type}
              onChange={(e) => set('item_type', e.target.value)}>
              {ITEM_TYPES.filter((t) => t.value !== 'all').map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={form.purchase_date}
              onChange={(e) => set('purchase_date', e.target.value)} required />
          </div>

          <div className="col-span-2">
            <label className="label">Product name <span className="text-ink-tertiary">(optional)</span></label>
            <input className="input" value={form.product_title}
              onChange={(e) => set('product_title', e.target.value)}
              placeholder="e.g. Bambu PLA Basic Black 1kg" />
          </div>

          <div>
            <label className="label">Qty</label>
            <input className="input font-mono" type="number" min="1" value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)} />
          </div>
          <div>
            <label className="label">Currency</label>
            <select className="input" value={form.currency}
              onChange={(e) => set('currency', e.target.value)}>
              {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'MXN'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Price per unit</label>
            <input className="input font-mono" type="number" step="0.01" min="0"
              value={form.price_per_unit} onChange={(e) => set('price_per_unit', e.target.value)}
              placeholder="0.00" />
          </div>
          <div>
            <label className="label">Total paid</label>
            <input className="input font-mono" type="number" step="0.01" min="0"
              value={form.total_paid} onChange={(e) => set('total_paid', e.target.value)}
              placeholder="0.00" />
          </div>

          <div>
            <label className="label">Order ID <span className="text-ink-tertiary">(optional)</span></label>
            <input className="input font-mono" value={form.order_id}
              onChange={(e) => set('order_id', e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 pt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.was_on_sale}
                onChange={(e) => set('was_on_sale', e.target.checked)} className="accent-accent" />
              <span className="text-xs text-ink-secondary">Was on sale</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_secondhand}
                onChange={(e) => set('is_secondhand', e.target.checked)} className="accent-accent" />
              <span className="text-xs text-ink-secondary">Secondhand</span>
            </label>
          </div>
        </div>

        {create.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(create.error as Error).message}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">
            {create.isPending ? 'Logging…' : 'Log purchase'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function PurchasesPage() {
  const { data: purchases = [], isLoading } = usePurchases()
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAdd, setShowAdd]       = useState(false)

  const filtered = typeFilter === 'all'
    ? purchases
    : purchases.filter((p) => p.record.item_type === typeFilter)

  // Total spend
  const totalSpend = purchases
    .reduce((acc, p) => acc + parseFloat(p.record.total_paid ?? p.record.price_per_unit ?? '0'), 0)

  return (
    <AppShell title="Purchases">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-ink-primary">Purchase History</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            {purchases.length} records · total{' '}
            <span className="font-mono">USD {totalSpend.toFixed(2)}</span>
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <IconPlus size={15} /> Log purchase
        </button>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {ITEM_TYPES.map((t) => {
          const count = t.value === 'all'
            ? purchases.length
            : purchases.filter((p) => p.record.item_type === t.value).length
          if (count === 0 && t.value !== 'all') return null
          return (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={[
                'px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
                typeFilter === t.value
                  ? 'bg-accent-subtle border-accent text-accent'
                  : 'bg-elevated border-border text-ink-secondary hover:border-border-strong',
              ].join(' ')}
            >
              {t.label}
              {count > 0 && <span className="ml-1 text-ink-tertiary">({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Timeline */}
      {isLoading && (
        <div className="card animate-pulse">
          <div className="h-48 bg-elevated rounded-md" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="card text-center py-12">
          <IconShoppingCart size={32} className="text-ink-tertiary mx-auto mb-3" stroke={1} />
          <p className="text-ink-secondary text-md font-medium">No purchases yet</p>
          <p className="text-ink-tertiary text-xs mt-1">
            Log purchases to track spending and build price history.
          </p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="card">
          {filtered.map((entry) => (
            <PurchaseRow key={entry.record.id} entry={entry} />
          ))}
        </div>
      )}

      {showAdd && <AddPurchaseModal onClose={() => setShowAdd(false)} />}
    </AppShell>
  )
}
