// Pure cost-calculation engine for unified projects.
// The route layer fetches DB rows and passes plain numbers in here.
//
// Model: print time lives on each plate, and each plate has its own batch_quantity
// (how many times that plate is run). The whole project yields `units_produced`
// finished, sellable items.

export interface PlateInput {
  // one entry per color on the plate
  colors: Array<{ grams_used: number; cost_per_gram: number }>
  print_time_min: number   // slicer time to print this plate once
  batch_quantity: number   // how many times this plate is run
}

export interface CostInputs {
  units_produced: number

  plates: PlateInput[]

  // Parts: one entry per part { quantity_per_unit, cost_per_unit }
  parts: Array<{ quantity_per_unit: number; cost_per_unit: number }>

  // Assembly (per finished item)
  assembly_time_min_per_unit: number | null

  // Settings
  electricity_rate_per_kwh: number
  printer_wattage_w: number
  labor_rate_per_hr: number
  include_electricity: boolean
  include_labor: boolean
}

export interface CostBreakdown {
  // totals for the whole project
  total_filament_cost: number
  parts_cost: number
  electricity_cost: number
  labor_cost: number
  total_project_cost: number
  cost_per_item: number

  // print time
  total_print_time_min: number
}

export interface PricingTiers {
  break_even: number
  fair: number
  market: number
  suggested: number
  profit_at_suggested: number
  margin_pct: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

export function calculateCost(input: CostInputs): CostBreakdown {
  const unitsProduced = Math.max(1, input.units_produced)

  // ── Filament + print time, summed across plates (× each plate's batch) ──
  let totalFilamentCost = 0
  let totalPrintTimeMin = 0

  for (const plate of input.plates) {
    const batch = Math.max(0, plate.batch_quantity)
    const plateFilamentCost = plate.colors.reduce(
      (sum, color) => sum + color.grams_used * color.cost_per_gram,
      0,
    )
    totalFilamentCost += plateFilamentCost * batch
    totalPrintTimeMin += (plate.print_time_min || 0) * batch
  }

  // ── Parts (per finished item × units produced) ──
  const partsCost = input.parts.reduce(
    (sum, p) => sum + p.quantity_per_unit * p.cost_per_unit,
    0,
  ) * unitsProduced

  const totalPrintTimeHrs = totalPrintTimeMin / 60
  const wattageKw = input.printer_wattage_w / 1000

  // ── Electricity ──
  const electricityCost = input.include_electricity
    ? totalPrintTimeHrs * wattageKw * input.electricity_rate_per_kwh
    : 0

  // ── Labor: assembly only (print time is unattended machine time, not labor) ──
  const assemblyTotalMin = (input.assembly_time_min_per_unit ?? 0) * unitsProduced
  const laborCost = input.include_labor
    ? (assemblyTotalMin / 60) * input.labor_rate_per_hr
    : 0

  const totalProjectCost = totalFilamentCost + partsCost + electricityCost + laborCost
  const costPerItem = totalProjectCost / unitsProduced

  return {
    total_filament_cost: round2(totalFilamentCost),
    parts_cost: round2(partsCost),
    electricity_cost: round2(electricityCost),
    labor_cost: round2(laborCost),
    total_project_cost: round2(totalProjectCost),
    cost_per_item: round4(costPerItem),
    total_print_time_min: Math.round(totalPrintTimeMin * 10) / 10,
  }
}

export function calculatePricingTiers(
  costPerItem: number,
  unitsProduced: number,
  markup: number,
  targetPrice: number | null,
): PricingTiers {
  const breakEven = costPerItem
  const fair = costPerItem * 2.0
  const market = costPerItem * markup
  const suggested = roundToCleanPrice(market)

  const priceForProfit = targetPrice && targetPrice > 0 ? targetPrice : suggested
  const profitAtSuggested = (priceForProfit - costPerItem) * Math.max(1, unitsProduced)
  const marginPct = priceForProfit > 0 ? ((priceForProfit - costPerItem) / priceForProfit) * 100 : 0

  return {
    break_even: round2(breakEven),
    fair: round2(fair),
    market: round2(market),
    suggested: round2(suggested),
    profit_at_suggested: round2(profitAtSuggested),
    margin_pct: Math.round(marginPct * 10) / 10,
  }
}

function roundToCleanPrice(price: number): number {
  if (price <= 0) return 0
  if (price < 5)  return Math.ceil(price * 4) / 4   // nearest $0.25
  if (price < 10) return Math.ceil(price * 2) / 2   // nearest $0.50
  if (price < 25) return Math.ceil(price)           // nearest $1
  return Math.ceil(price / 5) * 5                    // nearest $5
}

export function sellThroughAdvice(unitsSold: number, unitsProduced: number): string {
  const pct = unitsProduced > 0 ? (unitsSold / unitsProduced) * 100 : 0
  if (pct >= 100) return 'Sold out — you may be priced too low. Consider raising by $1–2 next time.'
  if (pct >= 85)  return 'Great sell-through — pricing looks right. If you sold out early, try $1–2 higher.'
  if (pct >= 50)  return 'Healthy sell-through. Adjust production volume to match demand.'
  return 'Under 50% sold. Consider lowering price or making fewer units next time.'
}

export interface InventoryShortfall {
  kind: 'filament' | 'part'
  label: string
  needed: number
  available: number
  gap: number
  unit: string
}
