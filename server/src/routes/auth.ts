import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { createMagicLink, verifyMagicLink, getSessionUser, destroySession } from '../lib/auth'
import { sendMagicLink } from '../lib/email'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { users } from '../db/schema'

const SESSION_COOKIE = 'fos_session'
const THIRTY_DAYS = 60 * 60 * 24 * 30

const auth = new Hono()

auth.post('/request-link', async (c) => {
  const { email } = await c.req.json<{ email: string }>()
  if (!email || !email.includes('@')) {
    return c.json({ error: 'Invalid email' }, 400)
  }

  const token = await createMagicLink(email)
  // Always return 200 — don't reveal whether email is on the allowlist
  if (token) {
    await sendMagicLink(email.toLowerCase(), token)
  }

  return c.json({ ok: true })
})

auth.get('/verify', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.json({ error: 'Missing token' }, 400)

  const result = await verifyMagicLink(token)
  if (!result) return c.json({ error: 'Invalid or expired link' }, 400)

  setCookie(c, SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: THIRTY_DAYS,
    path: '/',
  })

  const appUrl = process.env.APP_URL ?? 'http://localhost:5173'
  return c.redirect(appUrl)
})

auth.post('/logout', async (c) => {
  const sessionToken = getCookie(c, SESSION_COOKIE)
  if (sessionToken) await destroySession(sessionToken)
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
  return c.json({ ok: true })
})

auth.get('/me', async (c) => {
  const sessionToken = getCookie(c, SESSION_COOKIE)
  if (!sessionToken) return c.json({ error: 'Unauthenticated' }, 401)

  const user = await getSessionUser(sessionToken)
  if (!user) return c.json({ error: 'Unauthenticated' }, 401)

  return c.json(user)
})

export default auth
