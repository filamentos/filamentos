import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { userQuoteSettings } from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok } from '../lib/response'

// Cost & pricing settings — applies to all projects.
const settingsRoutes = new Hono()
settingsRoutes.use('*', requireAuth)

settingsRoutes.get('/', async (c) => {
  const userId = c.get('userId')
  const [settings] = await db
    .select()
    .from(userQuoteSettings)
    .where(eq(userQuoteSettings.user_id, userId))

  if (!settings) {
    return ok(c, {
      user_id: userId,
      electricity_rate_per_kwh: '0.14',
      default_printer_wattage_w: 200,
      labor_rate_per_hr: '15.00',
      include_electricity: true,
      include_labor: true,
      include_wear_costs: true,
      default_markup: '3.0',
      default_venue: 'farmers_market',
      default_packaging_cost: '0',
    })
  }
  return ok(c, settings)
})

settingsRoutes.patch('/', async (c) => {
  const userId = c.get('userId')
  type Body = Partial<{
    electricity_rate_per_kwh: number
    default_printer_wattage_w: number
    labor_rate_per_hr: number
    include_electricity: boolean
    include_labor: boolean
    include_wear_costs: boolean
    default_markup: number
    default_venue: string
    default_packaging_cost: number
  }>
  const body = await c.req.json<Body>()

  const setFields: Record<string, unknown> = { updated_at: new Date() }
  if (body.electricity_rate_per_kwh !== undefined) setFields.electricity_rate_per_kwh = body.electricity_rate_per_kwh.toString()
  if (body.default_printer_wattage_w !== undefined) setFields.default_printer_wattage_w = body.default_printer_wattage_w
  if (body.labor_rate_per_hr !== undefined) setFields.labor_rate_per_hr = body.labor_rate_per_hr.toString()
  if (body.include_electricity !== undefined) setFields.include_electricity = body.include_electricity
  if (body.include_labor !== undefined) setFields.include_labor = body.include_labor
  if (body.include_wear_costs !== undefined) setFields.include_wear_costs = body.include_wear_costs
  if (body.default_markup !== undefined) setFields.default_markup = body.default_markup.toString()
  if (body.default_venue !== undefined) setFields.default_venue = body.default_venue
  if (body.default_packaging_cost !== undefined) setFields.default_packaging_cost = body.default_packaging_cost.toString()

  await db
    .insert(userQuoteSettings)
    .values({ user_id: userId, ...setFields })
    .onConflictDoUpdate({ target: userQuoteSettings.user_id, set: setFields })

  const [updated] = await db
    .select()
    .from(userQuoteSettings)
    .where(eq(userQuoteSettings.user_id, userId))

  return ok(c, updated)
})

export default settingsRoutes
