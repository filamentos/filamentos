import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import authRoutes from './routes/auth'
import filamentRoutes from './routes/filament'

const app = new Hono()

app.use('*', logger())
app.use(
  '/api/*',
  cors({
    origin: process.env.APP_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
)

app.route('/api/auth', authRoutes)
app.route('/api/filament', filamentRoutes)

app.get('/health', (c) => c.json({ ok: true }))

// ── Export for Vercel (api/index.ts imports this) ─────────────
export default app

// ── Local dev server — not started on Vercel ──────────────────
if (!process.env.VERCEL) {
  const { serve } = await import('@hono/node-server')
  const port = Number(process.env.PORT ?? 3000)
  serve({ fetch: app.fetch, port }, () => {
    console.log(`FilamentOS server running on http://localhost:${port}`)
  })
}
