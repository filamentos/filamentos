import postgres from '../../../node_modules/postgres/src/index.js'

const url = process.env.DATABASE_URL
console.log('URL (masked):', url?.replace(/:([^:@]+)@/, ':***@'))

const sql = postgres(url, { max: 1, connect_timeout: 10 })
try {
  const result = await sql`SELECT current_user`
  console.log('✓ Connected as:', result[0].current_user)
} catch (e) {
  console.error('✗ Connection failed:', e.message)
} finally {
  await sql.end()
}
