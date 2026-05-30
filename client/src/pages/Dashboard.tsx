import { Link } from 'react-router-dom'
import {
  IconCylinder,
  IconPrinter,
  IconTool,
  IconShoppingCart,
  IconChevronRight,
  IconAlertTriangle,
} from '@tabler/icons-react'
import AppShell from '../components/AppShell'
import { useProfiles } from '../hooks/useFilament'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'

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
        <div
          className={[
            'w-7 h-7 rounded-md flex items-center justify-center',
            alert ? 'bg-danger-bg text-danger' : 'bg-elevated text-ink-secondary',
          ].join(' ')}
        >
          <Icon size={15} stroke={1.75} />
        </div>
        <IconChevronRight
          size={14}
          className="text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
        />
      </div>

      <p
        className="font-mono font-bold text-ink-primary leading-none mb-1"
        style={{ fontSize: '20px' }}
      >
        {value}
      </p>
      <p
        className="uppercase text-ink-tertiary font-semibold tracking-widest"
        style={{ fontSize: '9px', letterSpacing: '.06em' }}
      >
        {label}
      </p>
      {sub && (
        <p className="text-[10px] text-ink-tertiary mt-1">{sub}</p>
      )}
    </Link>
  )
}

// ── Alert strip ───────────────────────────────────────────────

function AlertBanner({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <div className="alert-strip-warning rounded-lg flex items-center gap-2 mb-5">
      <IconAlertTriangle size={14} />
      <span>{count} active alert{count !== 1 ? 's' : ''} — </span>
      <Link to="/alerts" className="underline hover:text-warning">View all</Link>
    </div>
  )
}

// ── Quick actions ─────────────────────────────────────────────

function QuickActions() {
  return (
    <div className="mt-6">
      <p
        className="uppercase text-ink-tertiary font-semibold tracking-widest mb-3"
        style={{ fontSize: '9px', letterSpacing: '.06em' }}
      >
        Quick actions
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to="/filament" className="btn-secondary text-xs py-1.5 px-3">
          <IconCylinder size={13} />
          Manage filament
        </Link>
        <Link to="/printers" className="btn-ghost text-xs py-1.5 px-3">
          <IconPrinter size={13} />
          Printers
        </Link>
        <Link to="/workshop" className="btn-ghost text-xs py-1.5 px-3">
          <IconTool size={13} />
          Workshop
        </Link>
        <Link to="/purchases" className="btn-ghost text-xs py-1.5 px-3">
          <IconShoppingCart size={13} />
          Log purchase
        </Link>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const { data: profiles = [] } = useProfiles()

  // Derive filament stats from already-loaded profiles
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
        <button
          onClick={handleLogout}
          className="btn-ghost text-xs py-1.5 px-3"
        >
          Sign out
        </button>
      </div>

      {/* Alert banner (placeholder — no alert system yet) */}
      <AlertBanner count={0} />

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Filament profiles"
          value={totalProfiles}
          icon={IconCylinder}
          to="/filament"
          sub={totalActive > 0 ? `${totalActive} active · ${totalReserve} reserve` : 'No spools yet'}
        />
        <StatCard
          label="Printers"
          value="—"
          icon={IconPrinter}
          to="/printers"
          sub="Phase 2"
        />
        <StatCard
          label="Workshop items"
          value="—"
          icon={IconTool}
          to="/workshop"
          sub="Phase 2"
        />
        <StatCard
          label="Purchases"
          value="—"
          icon={IconShoppingCart}
          to="/purchases"
          sub="Phase 2"
        />
      </div>

      <QuickActions />
    </AppShell>
  )
}
