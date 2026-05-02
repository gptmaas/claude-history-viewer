import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sessions, messages, syncState } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { validateApiKey, extractBearerToken } from '@/lib/auth-server'

interface SyncSession {
  sessionId: string
  display: string
  project: string
  projectName: string
  messageCount?: number
  timestamp: number
}

interface SyncMessage {
  type: string
  role?: string
  content: unknown
  uuid?: string
  timestamp?: string
  sessionId?: string
  metadata?: unknown
}

interface SyncPayload {
  sessions: SyncSession[]
  messages: SyncMessage[]
  syncCursor?: string
  sourceType?: string
}

export async function POST(request: NextRequest) {
  // Validate API key
  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const authResult = await validateApiKey(token)
  if (!authResult) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const userId = authResult.userId

  try {
    const body: SyncPayload = await request.json()
    const { sessions: syncSessions, messages: syncMessages, sourceType } = body

    const db = getDb()
    let syncedSessions = 0
    let syncedMessages = 0

    // Upsert sessions
    for (const s of syncSessions) {
      const startedAt = new Date(s.timestamp)

      const existing = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.userId, userId),
          eq(sessions.sessionId, s.sessionId),
        ),
      })

      if (existing) {
        await db.update(sessions)
          .set({
            display: s.display,
            messageCount: s.messageCount ?? existing.messageCount,
            lastMessageAt: startedAt,
            updatedAt: new Date(),
          })
          .where(eq(sessions.id, existing.id))
      } else {
        await db.insert(sessions).values({
          userId,
          sessionId: s.sessionId,
          display: s.display,
          project: s.project,
          projectName: s.projectName,
          messageCount: s.messageCount ?? 0,
          startedAt,
          lastMessageAt: startedAt,
        })
      }
      syncedSessions++
    }

    // Insert messages (skip duplicates by uuid)
    for (const m of syncMessages) {
      if (!m.uuid) continue

      // Find the session for this message
      const sessionId = m.sessionId
      if (!sessionId) continue

      const sessionRecord = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.userId, userId),
          eq(sessions.sessionId, sessionId),
        ),
      })

      if (!sessionRecord) continue

      // Check for duplicate
      const existingMsg = await db.query.messages.findFirst({
        where: eq(messages.uuid, m.uuid),
      })

      if (existingMsg) continue

      // Build search text from content
      const searchText = extractSearchText(m.content)

      await db.insert(messages).values({
        sessionId: sessionRecord.id,
        userId,
        type: m.type,
        role: m.role ?? null,
        content: m.content,
        uuid: m.uuid,
        timestamp: m.timestamp ? new Date(m.timestamp) : null,
        metadata: m.metadata ?? null,
        searchVector: searchText,
      })
      syncedMessages++
    }

    // Update sync state
    await db.insert(syncState).values({
      userId,
      sourceType: sourceType || 'claude-code',
      lastSyncedAt: new Date(),
      syncCursor: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: [syncState.userId, syncState.sourceType],
      set: {
        lastSyncedAt: new Date(),
        syncCursor: new Date().toISOString(),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      syncedSessions,
      syncedMessages,
      nextCursor: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error syncing data:', error)
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    )
  }
}

function extractSearchText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
      .map((block) => block.text)
      .join(' ')
  }
  return JSON.stringify(content)
}
