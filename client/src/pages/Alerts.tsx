import { useState } from 'react'
import {
  IconBell,
  IconCircleCheck,
  IconAlertTriangle,
  IconAlertCircle,
  IconX,
} from '@tabler/icons-react'
import AppShell from '../components/AppShell'
import Badge from '../components/ui/Badge'
import { useAlerts, useDismissAlert, useMarkAlertRead } from '../hooks/useAlerts'

function severityIcon(severity: string) {
  switch (severity) {
    case 'critical': return <IconAlertCircle size={16} className="text-danger shrink-0" />
    case 'warning':  return <IconAlertTriangle size={16} className="text-warning shrink-0" />
    default:         return <IconBell size={16} className="text-info shrink-0" />
  }
}

function severityBadge(severity: string) {
  switch (severity) {
    case 'critical': return <Badge variant="danger">Critical</Badge>
    case 'warning':  return <Badge variant="warning">Warning</Badge>
    default:         return <Badge variant="info">Info</Badge>
  }
}

export default function AlertsPage() {
  const { data: allAlerts = [], isLoading } = useAlerts()
  const dismiss = useDismissAlert()
  const markRead = useMarkAlertRead()
  const [showDismissed, setShowDismissed] = useState(false)

  const active    = allAlerts.filter((a) => !a.is_dismissed)
  const dismissed = allAlerts.filter((a) => a.is_dismissed)

  const shown = showDismissed ? allAlerts : active

  return (
    <AppShell title="Alerts">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-ink-primary">Alerts</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            {active.length} active · {dismissed.length} dismissed
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-ink-secondary">
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={(e) => setShowDismissed(e.target.checked)}
            className="accent-accent"
          />
          Show dismissed
        </label>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <div key={n} className="card animate-pulse h-12 bg-elevated" />)}
        </div>
      )}

      {!isLoading && shown.length === 0 && (
        <div className="card text-center py-12">
          <IconCircleCheck size={32} className="text-success mx-auto mb-3" stroke={1} />
          <p className="text-ink-secondary text-md font-medium">All clear</p>
          <p className="text-ink-tertiary text-xs mt-1">No active alerts.</p>
        </div>
      )}

      {!isLoading && shown.length > 0 && (
        <div className="space-y-2">
          {shown.map((alert) => (
            <div
              key={alert.id}
              className={[
                'card flex items-start gap-3',
                alert.is_read ? 'opacity-60' : '',
                alert.is_dismissed ? 'opacity-40' : '',
              ].join(' ')}
              onClick={() => { if (!alert.is_read) markRead.mutate(alert.id) }}
            >
              {severityIcon(alert.severity)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {severityBadge(alert.severity)}
                  <span className="text-[10px] text-ink-tertiary capitalize">{alert.alert_type?.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-sm text-ink-primary">{alert.message}</p>
                {alert.reorder_url && (
                  <a
                    href={alert.reorder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline mt-0.5 inline-block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Reorder →
                  </a>
                )}
              </div>
              {!alert.is_dismissed && (
                <button
                  className="btn-icon shrink-0 hover:bg-elevated"
                  title="Dismiss"
                  onClick={(e) => {
                    e.stopPropagation()
                    dismiss.mutate(alert.id)
                  }}
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  )
}
