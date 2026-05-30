import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

// prepare: false is required for Supabase pgBouncer (transaction-mode pooler).
// pgBouncer on port 6543 does not support prepared statements.
// max: 1 is appropriate for serverless functions (one connection per invocation).
const queryClient = postgres(connectionString, {
  max: 1,
  prepare: false,
})

export const db = drizzle(queryClient, { schema })
