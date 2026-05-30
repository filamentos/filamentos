import { randomBytes, createHash } from 'crypto'
import { eq, and, gt, isNull } from 'drizzle-orm'
import { db } from '../db/client'
import { allowedEmails, magicLinks, sessions, users } from '../db/schema'

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000   // 15 minutes
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000  // 30 days

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function createMagicLink(email: string): Promise<string | null> {
  const allowed = await db
    .select()
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email.toLowerCase()))
    .limit(1)

  if (allowed.length === 0) return null

  const token = randomBytes(32).toString('hex')
  const tokenHash = sha256(token)
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS)

  await db.insert(magicLinks).values({
    email: email.toLowerCase(),
    token_hash: tokenHash,
    expires_at: expiresAt,
  })

  return token
}

export async function verifyMagicLink(
  token: string,
): Promise<{ userId: string; sessionToken: string } | null> {
  const tokenHash = sha256(token)
  const now = new Date()

  const [link] = await db
    .select()
    .from(magicLinks)
    .where(
      and(
        eq(magicLinks.token_hash, tokenHash),
        gt(magicLinks.expires_at, now),
        isNull(magicLinks.used_at),
      ),
    )
    .limit(1)

  if (!link) return null

  // Mark link used
  await db
    .update(magicLinks)
    .set({ used_at: now })
    .where(eq(magicLinks.id, link.id))

  // Upsert user
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, link.email))
    .limit(1)

  if (!user) {
    ;[user] = await db
      .insert(users)
      .values({ email: link.email })
      .returning()
    // Mark first login on allowlist record
    await db
      .update(allowedEmails)
      .set({ first_login_at: now })
      .where(eq(allowedEmails.email, link.email))
  }

  // Create session
  const sessionToken = randomBytes(32).toString('hex')
  const sessionTokenHash = sha256(sessionToken)
  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await db.insert(sessions).values({
    user_id: user.id,
    token_hash: sessionTokenHash,
    expires_at: sessionExpiresAt,
    last_used_at: now,
  })

  return { userId: user.id, sessionToken }
}

export async function getSessionUser(sessionToken: string) {
  const tokenHash = sha256(sessionToken)
  const now = new Date()

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.token_hash, tokenHash),
        gt(sessions.expires_at, now),
      ),
    )
    .limit(1)

  if (!session) return null

  // Refresh last_used_at
  await db
    .update(sessions)
    .set({ last_used_at: now })
    .where(eq(sessions.id, session.id))

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user_id))
    .limit(1)

  return user ?? null
}

export async function destroySession(sessionToken: string): Promise<void> {
  const tokenHash = sha256(sessionToken)
  await db.delete(sessions).where(eq(sessions.token_hash, tokenHash))
}
