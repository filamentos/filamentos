import 'dotenv/config'
import { db } from '../client'
import { allowedEmails } from '../schema'

const emails = [
  'filamentosinfo@gmail.com',
]

console.log('Seeding allowlist…')

for (const email of emails) {
  await db
    .insert(allowedEmails)
    .values({ email })
    .onConflictDoNothing()
  console.log(`  ✓ ${email}`)
}

console.log('Done.')
process.exit(0)
