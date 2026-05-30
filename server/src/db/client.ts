import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Lazy singleton — connection is created on first use, not at module load time.
// This keeps cold starts fast and avoids connection errors crashing the module.
let _client: ReturnType<typeof drizzle> | null = null

function getClient() {
  if (_client) return _client

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  // prepare:false required for Supabase pgBouncer (transaction-mode pooler).
  // max:1 is appropriate for serverless — one connection per function instance.
  const sql = postgres(connectionString, { max: 1, prepare: false })
  _client = drizzle(sql, { schema })
  return _client
}

// Proxy so existing code using `db.select()` etc. works unchanged.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return getClient()[prop as keyof ReturnType<typeof drizzle>]
  },
})
