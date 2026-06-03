import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { IconChartLine, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { api } from '../../lib/api'

// One purchase point as returned by GET /purchases/price-history/:itemType/:itemId
interface PricePoint {
  purchase_date: string
  price_per_unit: string | null
  total_paid: string | null
  quantity: number | null
  source_name: string | null
}

const SOURCE_COLORS = ['#818cf8', '#4ade80', '#fbbf24', '#60a5fa', '#f87171', '#c084fc']

function unitPrice(p: PricePoint): number {
  if (p.price_per_unit) return parseFloat(p.price_per_unit)
  if (p.total_paid) return parseFloat(p.total_paid) / (p.quantity ?? 1)
  return 0
}

/**
 * Expandable "Price history" panel for a single inventory item.
 * Pulls that item's purchase records and renders a price-over-time chart.
 * Renders nothing chart-like until the user expands it (lazy query).
 */
export default function PriceHistory({
  itemType,
  itemId,
  currency = 'USD',
}: {
  itemType: string
  itemId: string
  currency?: string
}) {
  const [open, setOpen] = useState(false)

  const { data: points = [], isLoading } = useQuery({
    queryKey: ['price-history', itemType, itemId],
    queryFn: () => api.get<PricePoint[]>(`/purchases/price-history/${itemType}/${itemId}`),
    enabled: open,
  })

  const valid = points.filter((p) => unitPrice(p) > 0)
  const sources = [...new Set(valid.map((p) => p.source_name ?? 'Unknown'))]

  const chartData = [...valid]
    .sort((a, b) => a.purchase_date.localeCompare(b.purchase_date))
    .map((p) => ({
      date: new Date(p.purchase_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      [p.source_name ?? 'Unknown']: unitPrice(p),
    }))

  const prices = valid.map(unitPrice)
  const lowest  = prices.length ? Math.min(...prices) : 0
  const highest = prices.length ? Math.max(...prices) : 0
  const avg     = prices.length ? prices.reduce((s, n) => s + n, 0) / prices.length : 0
  const last    = prices.length ? prices[prices.length - 1] : 0

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <button
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-tertiary hover:text-ink-secondary transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
        <IconChartLine size={12} /> Price history
      </button>

      {open && (
        <div className="mt-3">
          {isLoading && <p className="text-xs text-ink-tertiary">Loading…</p>}

          {!isLoading && valid.length < 2 && (
            <p className="text-xs text-ink-tertiary">Not enough purchase history yet.</p>
          )}

          {!isLoading && valid.length >= 2 && (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#4a5a7a' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#4a5a7a' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#151e30',
                      border: '1px solid #1e2a3e',
                      borderRadius: 8,
                      fontSize: 11,
                      color: '#cdd6f4',
                    }}
                    formatter={(value) => [`${currency} ${Number(value).toFixed(2)}`, '']}
                  />
                  {sources.length > 1 && <Legend wrapperStyle={{ fontSize: 10, color: '#8896b8' }} />}
                  {sources.map((src, i) => (
                    <Line
                      key={src}
                      type="monotone"
                      dataKey={src}
                      stroke={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>

              <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-border text-xs font-mono">
                <span className="text-success">Low: {currency} {lowest.toFixed(2)}</span>
                <span className="text-danger">High: {currency} {highest.toFixed(2)}</span>
                <span className="text-ink-secondary">Avg: {currency} {avg.toFixed(2)}</span>
                <span className="text-ink-primary">Last: {currency} {last.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
