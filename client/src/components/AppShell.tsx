import { NavLink, useLocation } from 'react-router-dom'
import {
  IconHome,
  IconCylinder,
  IconPrinter,
  IconTool,
  IconBell,
  IconSettings,
  IconPackage,
  IconFile3d,
} from '@tabler/icons-react'
import { useAlerts } from '../hooks/useAlerts'

interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  badgeCount?: number
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',          icon: IconHome,         label: 'Dashboard' },
  { to: '/filament',  icon: IconCylinder,     label: 'Filament' },
  { to: '/printers',  icon: IconPrinter,      label: 'Printers' },
  { to: '/workshop',  icon: IconTool,         label: 'Workshop' },
  { to: '/kits',      icon: IconPackage,      label: 'Kits' },
  { to: '/projects',  icon: IconFile3d,       label: 'Projects' },
]

interface AppShellProps {
  title: string
  children: React.ReactNode
}

export default function AppShell({ title, children }: AppShellProps) {
  const { data: alerts = [] } = useAlerts()
  const alertCount = alerts.filter((a) => !a.is_dismissed).length
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && !a.is_dismissed).length

  const BOTTOM_NAV: NavItem[] = [
    { to: '/alerts',   icon: IconBell,     label: 'Alerts', badgeCount: alertCount },
    { to: '/settings', icon: IconSettings, label: 'Settings' },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      {/* ── Sidebar ─────────────────────────────── */}
      <aside
        className="flex flex-col items-center w-[52px] shrink-0 border-r border-border"
        style={{ background: '#0a1020' }}
      >
        {/* Logo mark */}
        <div className="flex items-center justify-center mt-3 mb-4">
          <div
            className="w-7 h-7 rounded-[7px] bg-accent-strong flex items-center justify-center"
            title="FilamentOS"
          >
            <span className="text-white font-black text-[13px] leading-none select-none">F</span>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex flex-col items-center gap-1 flex-1 w-full px-[10px]">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <SidebarIcon key={to} to={to} icon={Icon} label={label} exact={to === '/'} />
          ))}
        </nav>

        {/* Bottom nav */}
        <div className="flex flex-col items-center gap-1 w-full px-[10px] pb-3">
          {BOTTOM_NAV.map(({ to, icon: Icon, label, badgeCount }) => (
            <SidebarIcon
              key={to}
              to={to}
              icon={Icon}
              label={label}
              badgeCount={badgeCount}
              badgeCritical={to === '/alerts' && criticalCount > 0}
            />
          ))}
        </div>
      </aside>

      {/* ── Main area ───────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="h-11 shrink-0 flex items-center px-4 border-b border-border"
          style={{ background: '#0f1623' }}
        >
          <span className="text-md font-semibold text-ink-primary">{title}</span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  )
}

// ── Sidebar nav icon ──────────────────────────────────────────

interface SidebarIconProps {
  to: string
  icon: React.ElementType
  label: string
  exact?: boolean
  badgeCount?: number
  badgeCritical?: boolean
}

function SidebarIcon({
  to,
  icon: Icon,
  label,
  exact = false,
  badgeCount,
  badgeCritical = false,
}: SidebarIconProps) {
  const location = useLocation()
  const isActive = exact
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(to + '/')

  return (
    <NavLink
      to={to}
      title={label}
      className={[
        'relative flex items-center justify-center w-8 h-8 rounded-md transition-colors',
        isActive
          ? 'bg-elevated text-accent'
          : 'text-[#6b7db3] hover:bg-elevated hover:text-ink-secondary',
      ].join(' ')}
      style={
        isActive
          ? { boxShadow: 'inset 2px 0 0 0 #6366f1' }
          : undefined
      }
    >
      <Icon size={18} stroke={1.75} />

      {/* Alert count badge */}
      {badgeCount != null && badgeCount > 0 && (
        <span
          className={[
            'absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full',
            'flex items-center justify-center text-[9px] font-bold text-white px-[3px]',
            badgeCritical ? 'bg-danger' : 'bg-warning',
          ].join(' ')}
        >
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      )}
    </NavLink>
  )
}
