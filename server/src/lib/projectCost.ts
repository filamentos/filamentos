// Pure cost-calculation engine for unified projects.
// The route layer fetches DB rows and passes plain numbers in here.

export interface CostInputs {
  batch_quantity: number

  // Print time
  time_mode: 'per_unit' | 'per_plate'
  print_time_min_per_unit: number | null
  units_per_plate: number | null
  full_plate_time_min: number | null
  partial_plate_time_min: number | null

  // Assembly
  assembly_time_min_per_unit: number | null

  // Filament: one entry per plate-color { grams_used, cost_per_gram }
  filament: Array<{ grams_used: number; cost_per_gram: number }>

  // Parts: one entry per part { quantity_per_unit, cost_per_unit }
  parts: Array<{ quantity_per_unit: number; cost_per_unit: number }>

  // Settings
  electricity_rate_per_kwh: number
  printer_wattage_w: number
  labor_rate_per_hr: number
  include_electricity: boolean
  include_labor: boolean
  packaging_cost_per_unit: number
}

export interface CostBreakdown {
  // per unit
  filament_cost_per_unit: number
  parts_cost_per_unit: number
  electricity_cost_per_unit: number
  labor_cost_per_unit: number
  packaging_cost_per_unit: number
  cost_to_print_one: number

  // batch
  filament_cost_batch: number
  parts_cost_batch: number
  electricity_cost_batch: number
  labor_cost_batch: number
  packaging_cost_batch: number
  cost_to_print_batch: number

  // print time
  total_print_time_min: number
  full_plates: number
  partial_plate_units: number
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
  const batch = Math.max(1, input.batch_quantity)

  // ── Filament (per unit) ──
  const filamentPerUnit = input.filament.reduce(
    (sum, f) => sum + f.grams_used * f.cost_per_gram,
    0,
  )

  // ── Parts (per unit) ──
  const partsPerUnit = input.parts.reduce(
    (sum, p) => sum + p.quantity_per_unit * p.cost_per_unit,
    0,
  )

  // ── Total print time for the whole batch ──
  let totalPrintTimeMin = 0
  let fullPlates = 0
  let partialPlateUnits = 0

  if (input.time_mode === 'per_unit') {
    totalPrintTimeMin = (input.print_time_min_per_unit ?? 0) * batch
  } else {
    const perPlate = input.units_per_plate ?? 0
    if (perPlate > 0) {
      fullPlates = Math.floor(batch / perPlate)
      const remainder = batch % perPlate
      partialPlateUnits = remainder
      totalPrintTimeMin =
        fullPlates * (input.full_plate_time_min ?? 0) +
        (remainder > 0 ? (input.partial_plate_time_min ?? 0) : 0)
    }
  }

  const totalPrintTimeHrs = totalPrintTimeMin / 60
  const wattageKw = input.printer_wattage_w / 1000

  // ── Electricity (whole batch) ──
  const electricityBatch = input.include_electricity
    ? totalPrintTimeHrs * wattageKw * input.electricity_rate_per_kwh
    : 0

  // ── Labor (whole batch): print time + assembly across batch ──
  const assemblyTotalMin = (input.assembly_time_min_per_unit ?? 0) * batch
  const laborBatch = input.include_labor
    ? ((totalPrintTimeMin + assemblyTotalMin) / 60) * input.labor_rate_per_hr
    : 0

  // ── Packaging ──
  const packagingPerUnit = input.packaging_cost_per_unit ?? 0

  // ── Per-unit assembly: electricity + labor are batch-level, so divide ──
  const electricityPerUnit = electricityBatch / batch
  const laborPerUnit = laborBatch / batch

  const costToPrintOne =
    filamentPerUnit + partsPerUnit + electricityPerUnit + laborPerUnit + packagingPerUnit

  // ── Batch totals ──
  const filamentBatch = filamentPerUnit * batch
  const partsBatch = partsPerUnit * batch
  const packagingBatch = packagingPerUnit * batch
  const costToPrintBatch =
    filamentBatch + partsBatch + electricityBatch + laborBatch + packagingBatch

  return {
    filament_cost_per_unit: round4(filamentPerUnit),
    parts_cost_per_unit: round4(partsPerUnit),
    electricity_cost_per_unit: round4(electricityPerUnit),
    labor_cost_per_unit: round4(laborPerUnit),
    packaging_cost_per_unit: round4(packagingPerUnit),
    cost_to_print_one: round2(costToPrintOne),

    filament_cost_batch: round2(filamentBatch),
    parts_cost_batch: round2(partsBatch),
    electricity_cost_batch: round2(electricityBatch),
    labor_cost_batch: round2(laborBatch),
    packaging_cost_batch: round2(packagingBatch),
    cost_to_print_batch: round2(costToPrintBatch),

    total_print_time_min: Math.round(totalPrintTimeMin * 10) / 10,
    full_plates: fullPlates,
    partial_plate_units: partialPlateUnits,
  }
}

export function calculatePricingTiers(
  costToPrintOne: number,
  batchQuantity: number,
  markup: number,
  targetPrice: number | null,
): PricingTiers {
  const breakEven = costToPrintOne
  const fair = costToPrintOne * 2.0
  const market = costToPrintOne * markup
  const suggested = roundToCleanPrice(market)

  const priceForProfit = targetPrice && targetPrice > 0 ? targetPrice : suggested
  const profitAtSuggested = (priceForProfit - costToPrintOne) * Math.max(1, batchQuantity)
  const marginPct = priceForProfit > 0 ? ((priceForProfit - costToPrintOne) / priceForProfit) * 100 : 0

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

export function sellThroughAdvice(unitsSold: number, batchQty: number): string {
  const pct = batchQty > 0 ? (unitsSold / batchQty) * 100 : 0
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
