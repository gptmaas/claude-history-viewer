import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { syncState, sessions, messages, rawFiles } from '@/lib/db/schema'
import { eq, and, count, sql } from 'drizzle-orm'
import { validateApiKey, extractBearerToken } from '@/lib/auth-server'

export async function GET(request: NextRequest) {
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
    const db = getDb()

    const state = await db.query.syncState.findFirst({
      where: eq(syncState.userId, userId),
    })

    const [sessionCount] = await db
      .select({ count: count() })
      .from(sessions)
      .where(eq(sessions.userId, userId))

    const [messageCount] = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.userId, userId))

    const [rawFileCount] = await db
      .select({ count: count() })
      .from(rawFiles)
      .where(eq(rawFiles.userId, userId))

    const [pendingCount] = await db
      .select({ count: count() })
      .from(rawFiles)
      .where(and(
        eq(rawFiles.userId, userId),
        sql`${rawFiles.parsedAt} IS NULL`
      ))

    return NextResponse.json({
      lastSyncAt: state?.lastSyncedAt?.toISOString() ?? null,
      machineId: state?.machineId ?? null,
      machineName: state?.machineName ?? null,
      totalSessions: sessionCount?.count ?? 0,
      totalMessages: messageCount?.count ?? 0,
      totalRawFiles: rawFileCount?.count ?? 0,
      pendingParseCount: pendingCount?.count ?? 0,
      syncCursor: state?.syncCursor ?? null,
    })
  } catch (error) {
    console.error('Error getting sync status:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}
