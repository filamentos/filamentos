import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  IconCylinder,
  IconPrinter,
  IconTool,
  IconChevronRight,
  IconFile3d,
  IconWeight,
  IconChartBar,
} from '@tabler/icons-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import AppShell from '../components/AppShell'
import AlertBanner from '../components/ui/AlertBanner'
import Modal from '../components/ui/Modal'
import { useProfiles, useWeighSpool } from '../hooks/useFilament'
import { useAlerts } from '../hooks/useAlerts'
import { useAuthStore } from '../stores/auth'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { SpoolWithRemaining } from '../lib/filamentTypes'

// ── Stat card ─────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ElementType
  to: string
  sub?: string
  alert?: boolean
}

function StatCard({ label, value, icon: Icon, to, sub, alert = false }: StatCardProps) {
  return (
    <Link
      to={to}
      className="group block bg-surface border border-border rounded-md p-3 hover:border-border-strong transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <div className={['w-7 h-7 rounded-md flex items-center justify-center',
          alert ? 'bg-danger-bg text-danger' : 'bg-elevated text-ink-secondary'].join(' ')}>
          <Icon size={15} stroke={1.75} />
        </div>
        <IconChevronRight size={14} className="text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
      </div>
      <p className="font-mono font-bold text-ink-primary leading-none mb-1" style={{ fontSize: '20px' }}>
        {value}
      </p>
      <p className="uppercase text-ink-tertiary font-semibold tracking-widest" style={{ fontSize: '9px', letterSpacing: '.06em' }}>
        {label}
      </p>
      {sub && <p className="text-[10px] text-ink-tertiary mt-1">{sub}</p>}
    </Link>
  )
}

// ── Quick log weight modal ────────────────────────────────────

interface QuickWeighModalProps {
  onClose: () => void
}

function QuickWeighModal({ onClose }: QuickWeighModalProps) {
  const { data: profiles = [] } = useProfiles()
  const [selectedSpoolId, setSelectedSpoolId] = useState('')
  const [grossWeight, setGrossWeight] = useState('')
  const [eventType, setEventType] = useState<'weigh' | 'pre_print' | 'post_print'>('weigh')

  // Flatten all active spools from profiles with data
  const { data: allSpools = [] } = useQuery({
    queryKey: ['all-active-spools'],
    queryFn: () => api.get<SpoolWithRemaining[]>('/filament/spools?status=active'),
  })

  const weighMutation = useWeighSpool(selectedSpoolId)

  // Compute live remaining from selected spool
  const selectedSpool = allSpools.find((s) => s.id === selectedSpoolId)
  const emptyWeight = profiles.find((p) =>
    p.id === selectedSpool?.profile_id
  )?.empty_spool_weight_g

  const grossNum = parseFloat(grossWeight)
  const remaining = !isNaN(grossNum) && emptyWeight
    ? Math.max(0, grossNum - parseFloat(emptyWeight.toString())).toFixed(1)
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSpoolId) return
    const g = parseFloat(grossWeight)
    if (isNaN(g)) return
    await weighMutation.mutateAsync({ gross_weight_g: g, event_type: eventType })
    onClose()
  }

  const EVENT_TYPES = [
    { value: 'pre_print' as const, label: 'Pre-print' },
    { value: 'post_print' as const, label: 'Post-print' },
    { value: 'weigh' as const, label: 'Just checking' },
  ]

  return (
    <Modal title="Log Weight" onClose={onClose} width="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Spool selector */}
        <div>
          <label className="label">Spool</label>
          <select className="input" value={selectedSpoolId}
            onChange={(e) => setSelectedSpoolId(e.target.value)} required>
            <option value="">Select active spool…</option>
            {allSpools
              .filter((s) => s.status === 'active')
              .map((s) => {
                const prof = profiles.find((p) => p.id === s.profile_id)
                return (
                  <option key={s.id} value={s.id}>
                    {prof?.brand ?? '?'} {prof?.material ?? '?'} {prof?.color_name ? `· ${prof.color_name}` : ''}
                  </option>
                )
              })}
          </select>
        </div>

        {/* Event type toggle */}
        <div>
          <label className="label">Event</label>
          <div className="flex gap-1">
            {EVENT_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setEventType(value)}
                className={[
                  'flex-1 py-2 rounded-md text-xs font-semibold border transition-colors',
                  eventType === value
                    ? 'bg-accent-subtle border-accent text-accent'
                    : 'bg-elevated border-border text-ink-secondary hover:border-border-strong',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Large weight input */}
        <div>
          <label className="label">Gross weight (g)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            required
            value={grossWeight}
            onChange={(e) => setGrossWeight(e.target.value)}
            className="input font-mono w-full text-center"
            style={{ fontSize: 32, height: 60 }}
            placeholder="850.0"
            autoFocus
          />
          {remaining !== null && (
            <p className="text-center text-sm font-mono text-success mt-2">
              ≈ {remaining} g filament remaining
            </p>
          )}
        </div>

        {/* Recent history for selected spool */}
        {selectedSpool && (
          <RecentWeightHistory spoolId={selectedSpoolId} />
        )}

        {weighMutation.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(weighMutation.error as Error).message}
          </p>
        )}

        <button
          type="submit"
          disabled={weighMutation.isPending || !selectedSpoolId}
          className="btn-primary w-full justify-center"
          style={{ height: 48 }}
        >
          {weighMutation.isPending ? 'Saving…' : 'Log weight'}
        </button>
      </form>
    </Modal>
  )
}

function RecentWeightHistory({ spoolId }: { spoolId: string }) {
  const { data: logs = [] } = useQuery({
    queryKey: ['weight-logs', spoolId],
    queryFn: () => api.get<Array<{ gross_weight_g: string; logged_at: string; event_type: string }>>(`/filament/spools/${spoolId}/logs`),
    enabled: !!spoolId,
  })

  const recent = logs.slice(0, 3)
  if (recent.length === 0) return null

  return (
    <div className="rounded-md bg-elevated border border-border p-2.5">
      <p className="text-[10px] font-semibold uppercase text-ink-tertiary tracking-wider mb-1.5">Recent entries</p>
      {recent.map((log, i) => (
        <div key={i} className="flex items-center justify-between text-xs py-0.5">
          <span className="text-ink-tertiary">
            {new Date(log.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' · '}
            <span className="capitalize">{log.event_type.replace('_', ' ')}</span>
          </span>
          <span className="font-mono text-ink-secondary">{parseFloat(log.gross_weight_g).toFixed(1)} g</span>
        </div>
      ))}
    </div>
  )
}

// ── Quick actions ─────────────────────────────────────────────

function QuickActions({ onLogWeight }: { onLogWeight: () => void }) {
  return (
    <div className="mt-6">
      <p className="uppercase text-ink-tertiary font-semibold tracking-widest mb-3"
        style={{ fontSize: '9px', letterSpacing: '.06em' }}>
        Quick actions
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={onLogWeight} className="btn-secondary text-xs py-1.5 px-3">
          <IconWeight size={13} /> Log weight
        </button>
        <Link to="/filament" className="btn-secondary text-xs py-1.5 px-3">
          <IconCylinder size={13} /> Filament
        </Link>
        <Link to="/printers" className="btn-ghost text-xs py-1.5 px-3">
          <IconPrinter size={13} /> Printers
        </Link>
        <Link to="/workshop" className="btn-ghost text-xs py-1.5 px-3">
          <IconTool size={13} /> Workshop
        </Link>
      </div>
    </div>
  )
}

// ── Spend dashboard tab ───────────────────────────────────────

function SpendDashboard() {
  const { data: purchases = [] } = useQuery({
    queryKey: ['purchases'],
    queryFn: () => api.get<Array<{
      record: { total_paid: string | null; price_per_unit: string | null; quantity: number | null; item_type: string; purchase_date: string }
    }>>('/purchases'),
  })

  const totalAllTime = purchases.reduce((acc, p) => {
    const paid = parseFloat(p.record.total_paid ?? '0')
    const unit = parseFloat(p.record.price_per_unit ?? '0') * (p.record.quantity ?? 1)
    return acc + (paid || unit)
  }, 0)

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()

  const spentThisMonth = purchases
    .filter((p) => {
      const d = new Date(p.record.purchase_date)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    })
    .reduce((acc, p) => acc + parseFloat(p.record.total_paid ?? p.record.price_per_unit ?? '0'), 0)

  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear

  const spentLastMonth = purchases
    .filter((p) => {
      const d = new Date(p.record.purchase_date)
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear
    })
    .reduce((acc, p) => acc + parseFloat(p.record.total_paid ?? p.record.price_per_unit ?? '0'), 0)

  // Monthly bar chart data — last 6 months
  const monthlyData: Array<{ month: string; filament: number; parts: number; workshop: number; kits: number }> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1)
    const m = d.getMonth()
    const y = d.getFullYear()
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

    const forMonth = purchases.filter((p) => {
      const pd = new Date(p.record.purchase_date)
      return pd.getMonth() === m && pd.getFullYear() === y
    })

    const sum = (type: string) => forMonth
      .filter((p) => p.record.item_type === type)
      .reduce((s, p) => s + parseFloat(p.record.total_paid ?? p.record.price_per_unit ?? '0'), 0)

    monthlyData.push({
      month: label,
      filament: parseFloat(sum('filament_spool').toFixed(2)),
      parts:    parseFloat(sum('printer_part').toFixed(2)),
      workshop: parseFloat(sum('workshop_item').toFixed(2)),
      kits:     parseFloat(sum('print_kit').toFixed(2)),
    })
  }

  // Top 5 by spend
  const titleMap = new Map<string, number>()
  for (const p of purchases) {
    const title = p.record.item_type
    const spent = parseFloat(p.record.total_paid ?? p.record.price_per_unit ?? '0')
    titleMap.set(title, (titleMap.get(title) ?? 0) + spent)
  }
  const top5 = Array.from(titleMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Spend by category (pie)
  const categories = [
    { name: 'Filament',  value: parseFloat(purchases.filter((p) => p.record.item_type === 'filament_spool').reduce((s, p) => s + parseFloat(p.record.total_paid ?? p.record.price_per_unit ?? '0'), 0).toFixed(2)), color: '#818cf8' },
    { name: 'Parts',     value: parseFloat(purchases.filter((p) => p.record.item_type === 'printer_part').reduce((s, p) => s + parseFloat(p.record.total_paid ?? p.record.price_per_unit ?? '0'), 0).toFixed(2)), color: '#60a5fa' },
    { name: 'Workshop',  value: parseFloat(purchases.filter((p) => p.record.item_type === 'workshop_item').reduce((s, p) => s + parseFloat(p.record.total_paid ?? p.record.price_per_unit ?? '0'), 0).toFixed(2)), color: '#4ade80' },
    { name: 'Kits',      value: parseFloat(purchases.filter((p) => p.record.item_type === 'print_kit').reduce((s, p) => s + parseFloat(p.record.total_paid ?? p.record.price_per_unit ?? '0'), 0).toFixed(2)), color: '#fbbf24' },
    { name: 'Printers',  value: parseFloat(purchases.filter((p) => p.record.item_type === 'printer').reduce((s, p) => s + parseFloat(p.record.total_paid ?? p.record.price_per_unit ?? '0'), 0).toFixed(2)), color: '#f87171' },
  ].filter((c) => c.value > 0)

  if (purchases.length === 0) {
    return (
      <div className="card text-center py-12 mt-4">
        <IconChartBar size={32} className="text-ink-tertiary mx-auto mb-3" stroke={1} />
        <p className="text-ink-secondary text-md font-medium">No purchase data yet</p>
        <p className="text-ink-tertiary text-xs mt-1">Log purchases to see your spend dashboard.</p>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'All time',    value: `$${totalAllTime.toFixed(2)}` },
          { label: 'This month',  value: `$${spentThisMonth.toFixed(2)}` },
          { label: 'Last month',  value: `$${spentLastMonth.toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="card text-center py-3">
            <p className="text-xl font-mono font-bold text-ink-primary">{value}</p>
            <p className="text-[10px] uppercase text-ink-tertiary font-semibold tracking-wider mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Monthly bar chart */}
      <div className="card">
        <p className="text-sm font-semibold text-ink-primary mb-3">Monthly spend — last 6 months</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#4a5a7a' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#4a5a7a' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => `$${v}`} width={40} />
            <Tooltip
              contentStyle={{ background: '#151e30', border: '1px solid #1e2a3e', borderRadius: 8, fontSize: 11, color: '#cdd6f4' }}
              formatter={(v) => [`$${Number(v).toFixed(2)}`, '']}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: '#8896b8' }} />
            <Bar dataKey="filament" stackId="a" fill="#818cf8" />
            <Bar dataKey="parts"    stackId="a" fill="#60a5fa" />
            <Bar dataKey="workshop" stackId="a" fill="#4ade80" />
            <Bar dataKey="kits"     stackId="a" fill="#fbbf24" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 5 + Pie */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-sm font-semibold text-ink-primary mb-3">Top categories</p>
          {top5.map(([name, amount], i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 text-xs">
              <span className="text-ink-secondary capitalize">{name.replace('_', ' ')}</span>
              <span className="font-mono text-ink-primary">${amount.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {categories.length > 0 && (
          <div className="card">
            <p className="text-sm font-semibold text-ink-primary mb-3">By category</p>
            <PieChart width={200} height={160}>
              <Pie
                data={categories}
                cx={100} cy={75}
                innerRadius={45}
                outerRadius={70}
                dataKey="value"
              >
                {categories.map((c, i) => <Cell key={i} fill={c.color} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 10, color: '#8896b8' }} />
              <Tooltip
                contentStyle={{ background: '#151e30', border: '1px solid #1e2a3e', borderRadius: 8, fontSize: 11, color: '#cdd6f4' }}
                formatter={(v) => [`$${Number(v).toFixed(2)}`, '']}
              />
            </PieChart>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

type TabId = 'overview' | 'spend'

export default function Dashboard() {
  const user    = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const { data: profiles = [] }     = useProfiles()
  const { data: activeAlerts = [] } = useAlerts()

  const [tab, setTab]               = useState<TabId>('overview')
  const [showWeigh, setShowWeigh]   = useState(false)

  const totalProfiles = profiles.length
  const totalActive   = profiles.reduce((acc, p) => acc + p.spool_counts.active, 0)
  const totalReserve  = profiles.reduce((acc, p) => acc + p.spool_counts.reserve + p.spool_counts.partial_reserve, 0)

  async function handleLogout() {
    await api.post('/auth/logout')
    setUser(null)
  }

  return (
    <AppShell title="Dashboard">
      {/* Welcome row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-ink-primary">
            Hey, {user?.display_name ?? user?.email?.split('@')[0]} 👋
          </h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            Here's your print shop at a glance.
          </p>
        </div>
        <button onClick={handleLogout} className="btn-ghost text-xs py-1.5 px-3">
          Sign out
        </button>
      </div>

      {/* Live alert banner */}
      <AlertBanner alerts={activeAlerts} />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border pb-3">
        {[
          { id: 'overview' as TabId, label: 'Overview' },
          { id: 'spend'    as TabId, label: 'Spend', icon: IconChartBar },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
              tab === id
                ? 'bg-accent-subtle text-accent border border-accent'
                : 'text-ink-secondary hover:bg-elevated border border-transparent',
            ].join(' ')}
          >
            {Icon && <Icon size={13} />} {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Filament profiles"
              value={totalProfiles}
              icon={IconCylinder}
              to="/filament"
              sub={totalActive > 0 ? `${totalActive} active · ${totalReserve} reserve` : 'No spools yet'}
            />
            <StatCard label="Printers"    value="—" icon={IconPrinter}      to="/printers"  sub="See your fleet" />
            <StatCard label="Workshop"    value="—" icon={IconTool}         to="/workshop"  sub="Consumables & tools" />
            <StatCard label="Projects"    value="—" icon={IconFile3d}       to="/projects"  sub="Cost & price your prints" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <StatCard
              label="Active alerts"
              value={activeAlerts.filter((a) => !a.is_dismissed).length}
              icon={IconChartBar}
              to="/alerts"
              alert={activeAlerts.some((a) => a.severity === 'critical' && !a.is_dismissed)}
            />
          </div>

          <QuickActions onLogWeight={() => setShowWeigh(true)} />
        </>
      )}

      {tab === 'spend' && <SpendDashboard />}

      {showWeigh && <QuickWeighModal onClose={() => setShowWeigh(false)} />}
    </AppShell>
  )
}
