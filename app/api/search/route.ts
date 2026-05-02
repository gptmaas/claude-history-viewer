import { NextRequest, NextResponse } from 'next/server'
import { getDataSource } from '@/lib/data-source'
import { getUserId } from '@/lib/get-user-id'
import type { SearchResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''

    if (!query.trim()) {
      return NextResponse.json({ results: [], total: 0, query } as SearchResponse)
    }

    const userId = await getUserId()
    const ds = getDataSource()
    const response = await ds.searchSessions(userId, query)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error searching sessions:', error)
    return NextResponse.json(
      { error: 'Failed to search sessions' },
      { status: 500 }
    )
  }
}
