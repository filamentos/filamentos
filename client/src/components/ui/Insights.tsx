import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { IconChartHistogram, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { api } from '../../lib/api'

interface ProfileInsights {
  avg_empty_weight:  { value: number | null; sample_count: number }
  avg_net_yield:     { value: number | null; sample_count: number }
  avg_cost_per_gram: { value: number | null; purchase_count: number }
}

/**
 * Expandable "Insights" panel for a filament profile — three informational
 * running averages, each with its sample count. Display-only: these averages
 * never feed project or quote cost math. Lazily fetched on expand, styled to
 * match the Price History expander.
 */
export default function Insights({ profileId }: { profileId: string }) {
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['profile-insights', profileId],
    queryFn: () => api.get<ProfileInsights>(`/filament/profiles/${profileId}/insights`),
    enabled: open,
  })

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <button
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary hover:text-ink-secondary transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        <IconChartHistogram size={12} /> Insights
      </button>

      {open && (
        <div className="mt-3 space-y-1.5">
          {isLoading && <p className="text-xs text-ink-tertiary">Loading…</p>}

          {data && (
            <>
              <InsightRow
                label="Avg empty spool"
                value={data.avg_empty_weight.value != null ? `${data.avg_empty_weight.value}g` : null}
                detail={`${data.avg_empty_weight.sample_count} measured`}
              />
              <InsightRow
                label="Avg net yield"
                value={data.avg_net_yield.value != null ? `${data.avg_net_yield.value}g` : null}
                detail={`${data.avg_net_yield.sample_count} spool${data.avg_net_yield.sample_count === 1 ? '' : 's'}`}
              />
              <InsightRow
                label="Avg true cost/gram"
                value={data.avg_cost_per_gram.value != null ? `$${data.avg_cost_per_gram.value.toFixed(3)}` : null}
                detail={`${data.avg_cost_per_gram.purchase_count} purchase${data.avg_cost_per_gram.purchase_count === 1 ? '' : 's'}`}
              />
              <p className="text-[10px] text-ink-tertiary pt-1.5">
                Informational only — project &amp; quote costs always use the actual active spool's price.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function InsightRow({ label, value, detail }: { label: string; value: string | null; detail: string }) {
  return (
    <div className="flex items-baseline justify-between text-xs">
      <span className="text-ink-secondary">{label}</span>
      {value != null ? (
        <span className="font-mono text-ink-primary">
          {value} <span className="text-ink-tertiary font-sans">({detail})</span>
        </span>
      ) : (
        <span className="text-ink-tertiary">Not enough data yet.</span>
      )}
    </div>
  )
}
