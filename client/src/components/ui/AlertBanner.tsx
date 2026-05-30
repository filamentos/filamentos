import { IconAlertTriangle, IconAlertCircle, IconX } from '@tabler/icons-react'
import { useDismissAlert } from '../../hooks/useAlerts'
import type { Alert } from '@shared/types'

interface AlertBannerProps {
  alerts: Alert[]
}

export default function AlertBanner({ alerts }: AlertBannerProps) {
  const dismiss = useDismissAlert()

  const critical = alerts.filter((a) => a.severity === 'critical')
  const warnings = alerts.filter((a) => a.severity === 'warning')

  if (alerts.length === 0) return null

  return (
    <div className="space-y-1 mb-5">
      {critical.map((a) => (
        <div key={a.id} className="alert-strip-critical rounded-lg flex items-start justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <IconAlertCircle size={14} className="shrink-0" />
            <span className="truncate">{a.message}</span>
            {a.reorder_url && (
              <a
                href={a.reorder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 underline opacity-70 hover:opacity-100"
              >
                Reorder
              </a>
            )}
          </div>
          <button
            onClick={() => dismiss.mutate(a.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            title="Dismiss"
          >
            <IconX size={13} />
          </button>
        </div>
      ))}
      {warnings.map((a) => (
        <div key={a.id} className="alert-strip-warning rounded-lg flex items-start justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <IconAlertTriangle size={14} className="shrink-0" />
            <span className="truncate">{a.message}</span>
            {a.reorder_url && (
              <a
                href={a.reorder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 underline opacity-70 hover:opacity-100"
              >
                Reorder
              </a>
            )}
          </div>
          <button
            onClick={() => dismiss.mutate(a.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            title="Dismiss"
          >
            <IconX size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
