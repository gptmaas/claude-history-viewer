import { NextResponse } from 'next/server'
import { getDataSource } from '@/lib/data-source'
import { getUserId } from '@/lib/get-user-id'
import type { DashboardStats } from '@/lib/types'

export const dynamic = 'force-dynamic'

export type { DashboardStats } from '@/lib/types'
export type { ProjectStats, DailyMessageCount } from '@/lib/types'

export async function GET() {
  try {
    const userId = await getUserId()
    const ds = getDataSource()
    const stats: DashboardStats = await ds.getDashboardStats(userId)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error loading dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard stats' },
      { status: 500 }
    )
  }
}
