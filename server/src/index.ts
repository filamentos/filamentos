import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import authRoutes from './routes/auth'
import filamentRoutes from './routes/filament'
import alertRoutes from './routes/alerts'
import printerRoutes from './routes/printers'
import partsRoutes from './routes/parts'
import workshopRoutes from './routes/workshop'
import purchaseRoutes from './routes/purchases'

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
app.route('/api/alerts', alertRoutes)
app.route('/api/printers', printerRoutes)
app.route('/api/printers', partsRoutes)
app.route('/api/workshop', workshopRoutes)
app.route('/api/purchases', purchaseRoutes)

app.get('/health', (c) => c.json({ ok: true, env: !!process.env.DATABASE_URL }))

// ── Global error handler — logs the real cause to Vercel function logs ──
app.onError((err, c) => {
  console.error('[FilamentOS]', err.message, '\n', err.stack)
  return c.json({ error: err.message }, 500)
})

// ── Export for Vercel ─────────────────────────────────────────
console.log('[FilamentOS] app initialised, DATABASE_URL present:', !!process.env.DATABASE_URL)
export default app

// ── Local dev server ──────────────────────────────────────────
if (!process.env.VERCEL) {
  import('@hono/node-server').then(({ serve }) => {
    const port = Number(process.env.PORT ?? 3000)
    serve({ fetch: app.fetch, port }, () => {
      console.log(`FilamentOS server running on http://localhost:${port}`)
    })
  })
}
