import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Use direct connection for migrations — pgBouncer pooler blocks DDL statements
const connectionString = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL_DIRECT or DATABASE_URL is required')

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = join(__dirname, 'migrations')

const sql = postgres(connectionString, { max: 1 })
const db = drizzle(sql)

console.log('Running migrations…')
await migrate(db, { migrationsFolder })
console.log('Migrations complete.')
await sql.end()
