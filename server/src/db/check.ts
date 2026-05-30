import 'dotenv/config'
import { db } from './client'
import { allowedEmails } from './schema'

const rows = await db.select().from(allowedEmails)
console.log('allowed_emails table:', rows)
process.exit(0)
