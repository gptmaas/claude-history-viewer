import { NextRequest, NextResponse } from 'next/server'
import { getSessionCache } from '@/lib/session-cache'
import type { SessionsResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const project = searchParams.get('project')

    // Get sessions from cache
    const sessionCache = getSessionCache()
    let sessions = await sessionCache.getSessionList()

    // Filter by project if specified
    if (project) {
      sessions = sessions.filter((s) => s.project === project)
    }

    const total = sessions.length
    const start = (page - 1) * pageSize
    const paginatedSessions = sessions.slice(start, start + pageSize)

    // Convert Date to ISO string for JSON serialization
    const sessionsForResponse = paginatedSessions.map((s) => ({
      ...s,
      date: s.date.toISOString(),
    }))

    const response: SessionsResponse = {
      sessions: sessionsForResponse,
      total,
      page,
      pageSize,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error loading sessions:', error)
    return NextResponse.json(
      { error: 'Failed to load sessions' },
      { status: 500 }
    )
  }
}
