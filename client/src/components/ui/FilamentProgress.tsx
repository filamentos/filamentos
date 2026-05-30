interface FilamentProgressProps {
  pct: number | null
  /** compact mode — no label, thinner bar */
  compact?: boolean
}

function fillClass(pct: number | null): string {
  if (pct == null) return 'progress-fill-good opacity-30'
  if (pct < 10)  return 'progress-fill-danger'
  if (pct < 30)  return 'progress-fill-warning'
  return 'progress-fill-good'
}

export default function FilamentProgress({ pct, compact = false }: FilamentProgressProps) {
  const display = pct != null ? Math.round(pct) : null

  return (
    <div className="space-y-1">
      {!compact && (
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-ink-tertiary uppercase tracking-wide font-semibold">
            Remaining
          </span>
          <span className="text-[11px] font-mono text-ink-secondary">
            {display != null ? `${display}%` : '—'}
          </span>
        </div>
      )}
      <div className="progress-track">
        <div
          className={fillClass(pct)}
          style={{ width: `${display ?? 50}%` }}
        />
      </div>
    </div>
  )
}
