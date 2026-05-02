import { NextResponse } from 'next/server'
import { getStatsCache, warmStatsCache } from '@/lib/stats-cache'
import { startFileWatcher } from '@/lib/file-watcher'
import type { DashboardStats } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Re-export types for use in other files
export type { DashboardStats } from '@/lib/types'
export type { ProjectStats, DailyMessageCount } from '@/lib/types'

export async function GET() {
  try {
    // Start file watcher on first request
    startFileWatcher()

    // Warm cache on first request (idempotent due to cache check)
    warmStatsCache()

    // Get stats from cache
    const statsCache = getStatsCache()
    const stats = await statsCache.getStats()

    const response: DashboardStats = {
      lastDayCount: stats.lastDayCount,
      lastWeekCount: stats.lastWeekCount,
      totalSessions: stats.totalSessions,
      totalUserMessages: stats.totalUserMessages,
      totalAssistantMessages: stats.totalAssistantMessages,
      lastDayUserMessages: stats.lastDayUserMessages,
      lastDayAssistantMessages: stats.lastDayAssistantMessages,
      topProjects: stats.topProjects,
      dailyMessageCounts: stats.dailyMessageCounts,
      lastUpdated: stats.lastUpdated,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error loading dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard stats' },
      { status: 500 }
    )
  }
}
