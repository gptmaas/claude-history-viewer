import { NextRequest, NextResponse } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const itemId = request.nextUrl.searchParams.get('itemId')
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    }
    const ds = getPipelineDataSource()
    const events = await ds.getEventsForItem(Number(itemId))
    return NextResponse.json(events)
  } catch (error) {
    console.error('Error getting pipeline events:', error)
    return NextResponse.json({ error: 'Failed to get events' }, { status: 500 })
  }
}
