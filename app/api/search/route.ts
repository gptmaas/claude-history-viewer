import { NextRequest, NextResponse } from 'next/server'
import { getDataSource } from '@/lib/data-source'
import { getUserId } from '@/lib/get-user-id'
import type { SearchResponse, SearchFilters } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const project = searchParams.get('project') || undefined
    const machine = searchParams.get('machine') || undefined
    const source = searchParams.get('source') || undefined
    const type = searchParams.get('type') || undefined
    const tool = searchParams.get('tool') || undefined
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

    if (!query.trim()) {
      return NextResponse.json({ results: [], total: 0, query } as SearchResponse)
    }

    const filters: SearchFilters = {
      query,
      project,
      machineId: machine,
      sourceType: source,
      messageType: type,
      toolName: tool,
      dateRange: from || to ? { start: from || '', end: to || '' } : undefined,
    }

    const userId = await getUserId()
    const ds = getDataSource()
    const response = await ds.searchSessions(userId, filters)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error searching sessions:', error)
    return NextResponse.json(
      { error: 'Failed to search sessions' },
      { status: 500 }
    )
  }
}
