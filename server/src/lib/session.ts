import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { getSessionUser } from './auth'

const SESSION_COOKIE = 'fos_session'

declare module 'hono' {
  interface ContextVariableMap {
    userId: string
  }
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const sessionToken = getCookie(c, SESSION_COOKIE)
  if (!sessionToken) return c.json({ error: 'Unauthenticated' }, 401)

  const user = await getSessionUser(sessionToken)
  if (!user) return c.json({ error: 'Unauthenticated' }, 401)

  c.set('userId', user.id)
  await next()
}
