import { NextRequest, NextResponse } from 'next/server'
import { getDataSource } from '@/lib/data-source'
import { getUserId } from '@/lib/get-user-id'
import type { AnalyticsStats } from '@/lib/types'

export const dynamic = 'force-dynamic'

export type { AnalyticsStats } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId()
    const ds = getDataSource()

    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || '30d'

    let startDate: Date
    const endDate = new Date()

    switch (range) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'all':
        startDate = new Date(0)
        break
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }

    const stats: AnalyticsStats = await ds.getAnalyticsStats(userId, { start: startDate, end: endDate })

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error loading analytics stats:', error)
    return NextResponse.json(
      { error: 'Failed to load analytics stats' },
      { status: 500 }
    )
  }
}
