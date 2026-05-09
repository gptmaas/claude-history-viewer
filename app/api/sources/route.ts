import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { syncState, sessions, rawFiles } from '@/lib/db/schema'
import { eq, count, sql } from 'drizzle-orm'
import { getUserId } from '@/lib/get-user-id'
import { getAllParserNames } from '@/lib/parsers/registry'

export const dynamic = 'force-dynamic'

const SOURCE_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'codex-cli': 'Codex CLI',
}

export async function GET() {
  try {
    const userId = await getUserId()
    const db = getDb()

    // Get all registered parsers as available sources
    const availableSources = getAllParserNames()

    // Get sync state per source
    const syncStates = await db.query.syncState.findMany({
      where: eq(syncState.userId, userId),
    })

    // Get session counts per source type
    const sessionCounts = await db
      .select({
        sourceType: sessions.sourceType,
        count: count(),
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .groupBy(sessions.sourceType)

    const sessionCountMap = new Map(sessionCounts.map(r => [r.sourceType, r.count]))

    // Get raw file counts per source type
    const fileCounts = await db
      .select({
        sourceType: rawFiles.sourceType,
        count: count(),
      })
      .from(rawFiles)
      .where(eq(rawFiles.userId, userId))
      .groupBy(rawFiles.sourceType)

    const fileCountMap = new Map(fileCounts.map(r => [r.sourceType, r.count]))

    const sources = availableSources.map(name => {
      const state = syncStates.find(s => s.sourceType === name)
      return {
        name,
        label: SOURCE_LABELS[name] || name,
        lastSyncAt: state?.lastSyncedAt?.toISOString() ?? null,
        sessionCount: sessionCountMap.get(name) ?? 0,
        fileCount: fileCountMap.get(name) ?? 0,
      }
    })

    return NextResponse.json({ sources })
  } catch (error) {
    console.error('Error loading sources:', error)
    return NextResponse.json(
      { error: 'Failed to load sources' },
      { status: 500 }
    )
  }
}
