import { NextRequest, NextResponse } from 'next/server'
import { getSessionCache } from '@/lib/session-cache'
import type { SessionDetailResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get session detail from cache
    const sessionCache = getSessionCache()
    const detail = await sessionCache.getSessionDetail(id)

    if (!detail) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Convert Date to ISO string for JSON serialization
    const sessionWithDate = {
      ...detail.session,
      date: detail.session.date.toISOString(),
    }

    const response: SessionDetailResponse = {
      session: sessionWithDate,
      messages: detail.messages,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error loading session detail:', error)
    return NextResponse.json(
      { error: 'Failed to load session detail' },
      { status: 500 }
    )
  }
}
