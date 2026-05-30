import { Hono } from 'hono'
import { eq, ilike } from 'drizzle-orm'
import { db } from '../db/client'
import { materialReference } from '../db/schema'
import { requireAuth } from '../lib/session'
import { ok, err } from '../lib/response'

const materialRoutes = new Hono()
materialRoutes.use('*', requireAuth)

materialRoutes.get('/', async (c) => {
  const all = await db.select().from(materialReference).orderBy(materialReference.name)
  return ok(c, all)
})

materialRoutes.get('/:material', async (c) => {
  const name = c.req.param('material')

  const [mat] = await db
    .select()
    .from(materialReference)
    .where(ilike(materialReference.name, name))
    .limit(1)

  if (!mat) return err(c, 'Material not found', 404)
  return ok(c, mat)
})

export default materialRoutes
