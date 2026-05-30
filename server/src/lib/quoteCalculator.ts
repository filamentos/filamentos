import { quoteLineItems, quoteProjects, userQuoteSettings } from '../db/schema'

export type LineItem = typeof quoteLineItems.$inferSelect

export interface QuoteTotals {
  true_cost_per_unit: number
  total_batch_cost: number
  break_even: number
  fair_price: number
  market_price: number
  suggested_price: number
  profit_at_suggested: number
  margin_pct: number
}

export function calculateTotals(
  lineItems: LineItem[],
  batchQty: number,
  settings: typeof userQuoteSettings.$inferSelect | null,
): QuoteTotals {
  const trueCost = lineItems.reduce((sum, li) => {
    return sum + parseFloat(li.line_cost_per_unit ?? '0')
  }, 0)

  const markup = parseFloat(settings?.default_markup ?? '3.0')

  const breakEven   = trueCost
  const fairPrice   = trueCost * 2.0
  const marketPrice = trueCost * markup

  const suggested = roundToCleanPrice(marketPrice)

  const profitAtSuggested = (suggested - trueCost) * batchQty
  const marginPct = suggested > 0 ? ((suggested - trueCost) / suggested) * 100 : 0

  return {
    true_cost_per_unit: roundCents(trueCost),
    total_batch_cost:   roundCents(trueCost * batchQty),
    break_even:         roundCents(breakEven),
    fair_price:         roundCents(fairPrice),
    market_price:       roundCents(marketPrice),
    suggested_price:    roundCents(suggested),
    profit_at_suggested: roundCents(profitAtSuggested),
    margin_pct:         Math.round(marginPct * 10) / 10,
  }
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}

function roundToCleanPrice(price: number): number {
  if (price <= 0) return 0

  // Round up to clean numbers: nearest $0.50 if < $10, nearest $1 if < $25, nearest $5 above
  if (price < 5) {
    return Math.ceil(price * 4) / 4   // nearest $0.25
  } else if (price < 10) {
    return Math.ceil(price * 2) / 2   // nearest $0.50
  } else if (price < 25) {
    return Math.ceil(price)            // nearest $1
  } else {
    return Math.ceil(price / 5) * 5   // nearest $5
  }
}

export function sellThroughAdvice(
  unitsSold: number,
  batchQty: number,
  targetPrice: number,
  trueCost: number,
): string {
  const pct = batchQty > 0 ? (unitsSold / batchQty) * 100 : 0

  if (pct >= 100) {
    return "Sold out — you may be priced too low. Consider raising by $1–2 next time."
  } else if (pct >= 85) {
    return "Great sell-through — pricing looks right. If you sold out early, try $1–2 higher."
  } else if (pct >= 50) {
    return "Healthy sell-through. Adjust production volume to match demand."
  } else {
    return "Under 50% sold. Consider lowering price or making fewer units next time."
  }
}

export function beginnerTips(
  quote: typeof quoteProjects.$inferSelect,
  lineItems: LineItem[],
  settings: typeof userQuoteSettings.$inferSelect | null,
): string[] {
  const tips: string[] = []

  const laborRate = parseFloat(settings?.labor_rate_per_hr ?? '0')
  if (laborRate === 0) {
    tips.push("Your labor rate is $0. Your time has value — even 3 min of assembly per item adds cost.")
  }

  const tableFee = parseFloat(quote.table_fee ?? '0')
  if (tableFee === 0 && quote.selling_venue === 'farmers_market') {
    tips.push("Don't forget the table fee! A $40 table / 20 items = $2 each before you make a cent.")
  }

  const targetPrice = parseFloat(quote.target_price ?? '0')
  const trueCost = lineItems.reduce((s, li) => s + parseFloat(li.line_cost_per_unit ?? '0'), 0)
  if (targetPrice > 0 && targetPrice < trueCost * 2) {
    tips.push(`Your sell price ($${targetPrice.toFixed(2)}) is below 2× cost. You'll cover materials but not your time.`)
  }

  if (quote.saved_project_id) {
    tips.push("Check the commercial license on the original design before selling prints — many designers require a paid license.")
  }

  return tips
}
