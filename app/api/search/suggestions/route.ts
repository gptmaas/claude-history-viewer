import { NextRequest, NextResponse } from 'next/server'
import { getDataSource } from '@/lib/data-source'
import { getUserId } from '@/lib/get-user-id'
import type { SearchSuggestion } from '@/lib/types'
import { getDb } from '@/lib/db'
import { sessions, messages } from '@/lib/db/schema'
import { eq, ilike, and, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const q = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    if (!q.trim()) {
      return NextResponse.json({ suggestions: [] })
    }

    const suggestions: SearchSuggestion[] = []
    const prefix = `${q}%`

    // Cloud mode: query database
    const mode = process.env.DATA_SOURCE_MODE || 'local'
    if (mode === 'cloud') {
      try {
        const userId = await getUserId()
        if (!userId) {
          return NextResponse.json({ suggestions: [] })
        }

        const db = getDb()

        // Session title suggestions
        const titleRows = await db
          .selectDistinct({ display: sessions.display, project: sessions.project })
          .from(sessions)
          .where(and(
            eq(sessions.userId, userId),
            ilike(sessions.display, prefix),
          ))
          .limit(limit)

        for (const row of titleRows) {
          suggestions.push({
            type: 'session',
            label: row.display,
            description: row.project,
          })
        }

        // Tool name suggestions
        const remaining = limit - suggestions.length
        if (remaining > 0) {
          const toolRows = await db
            .selectDistinct({
              name: sql<string>`${messages.content}->0->>'name'`,
            })
            .from(messages)
            .where(and(
              eq(messages.userId, userId),
              eq(messages.type, 'assistant'),
              ilike(sql`${messages.content}->0->>'name'`, prefix),
            ))
            .limit(remaining)

          for (const row of toolRows) {
            if (row.name) {
              suggestions.push({
                type: 'tool',
                label: row.name,
              })
            }
          }
        }
      } catch (err) {
        console.warn('Suggestions query failed:', err)
      }
    }

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error getting suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to get suggestions' },
      { status: 500 }
    )
  }
}
