import crypto from 'crypto'

const API_KEY_PREFIX = 'chk_live_'

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = API_KEY_PREFIX + crypto.randomBytes(32).toString('hex')
  const hash = hashApiKey(raw)
  const prefix = raw.slice(0, 16)
  return { raw, hash, prefix }
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

export async function validateApiKey(key: string): Promise<{ userId: string } | null> {
  if (!key.startsWith(API_KEY_PREFIX)) return null

  const { getDb } = require('./db') as typeof import('./db')
  const { apiKeys } = require('./db/schema') as typeof import('./db/schema')
  const { eq } = require('drizzle-orm')
  const hash = hashApiKey(key)

  const db = getDb()
  const apiKeyRecord = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, hash),
  })

  if (!apiKeyRecord) return null

  // Update last used
  await db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, apiKeyRecord.id))

  return { userId: apiKeyRecord.userId }
}
