/**
 * Stats Cache
 *
 * Caches dashboard statistics with automatic refresh and persistence
 */

import { loadSessionsList } from './claude-history'
import { getSessionCache } from './session-cache'
import { getCacheManager } from './cache-manager'
import { cacheConfig } from './cache-config'
import type { DashboardStats } from '../app/api/stats/route'
import type { SessionDetail } from './types'

const CACHE_NAME = 'stats'
const CACHE_KEY = 'dashboard'
const PERSIST_FILE = 'stats.json'

interface CachedDashboardStats extends DashboardStats {
  lastUpdated: number
  cachedAt: number
  version: string
}

const CACHE_VERSION = '1.0'

/**
 * Compute dashboard stats from sessions
 * Optimized to load session details once and reuse them
 */
async function computeStats(): Promise<DashboardStats> {
  const sessions = await loadSessionsList()
  const sessionCache = getSessionCache()
  const now = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000
  const oneWeekMs = 7 * oneDayMs

  // Calculate time-based counts
  const lastDayCount = sessions.filter(s => s.timestamp > now - oneDayMs).length
  const lastWeekCount = sessions.filter(s => s.timestamp > now - oneWeekMs).length

  // Load all session details ONCE into a Map for reuse
  // Limit to 50 most recent sessions for performance (reduced from 200)
  const recentSessions = sessions
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50)

  const sessionDetailsMap = new Map<string, SessionDetail>()

  // Load sessions in parallel with concurrency limit for better performance
  const BATCH_SIZE = 10
  for (let i = 0; i < recentSessions.length; i += BATCH_SIZE) {
    const batch = recentSessions.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(session => sessionCache.getSessionDetail(session.sessionId))
    )
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        sessionDetailsMap.set(batch[idx].sessionId, result.value)
      }
    })
  }

  // Count messages by type using the pre-loaded Map
  let totalUserMessages = 0
  let totalAssistantMessages = 0
  let lastDayUserMessages = 0
  let lastDayAssistantMessages = 0

  for (const session of recentSessions) {
    const detail = sessionDetailsMap.get(session.sessionId)
    if (!detail) continue

    for (const msg of detail.messages) {
      const msgTime = msg.timestamp ? new Date(msg.timestamp).getTime() : 0
      const isLastDay = msgTime > now - oneDayMs

      if (msg.type === 'user') {
        totalUserMessages++
        if (isLastDay) lastDayUserMessages++
      } else if (msg.type === 'assistant') {
        totalAssistantMessages++
        if (isLastDay) lastDayAssistantMessages++
      }
    }
  }

  // Aggregate by project (simplified - no per-project message counts for performance)
  const projectMap = new Map<string, DashboardStats['topProjects'][0]>()

  for (const session of sessions) {
    const key = session.project
    if (!projectMap.has(key)) {
      projectMap.set(key, {
        project: session.project,
        projectName: session.projectName,
        totalSessions: 0,
        lastUpdate: session.timestamp,
        recentSessions: 0,
      })
    }
    const stats = projectMap.get(key)!
    stats.totalSessions++
    if (session.timestamp > now - oneDayMs) {
      stats.recentSessions++
    }
    if (session.timestamp > stats.lastUpdate) {
      stats.lastUpdate = session.timestamp
    }
  }

  // Sort by last update time and take top 10
  const topProjects = Array.from(projectMap.values())
    .sort((a, b) => b.lastUpdate - a.lastUpdate)
    .slice(0, 10)

  // Calculate daily message counts for the last 7 days using the pre-loaded Map
  const dailyMessageCounts: DashboardStats['dailyMessageCounts'] = []
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    const dayStartMs = dayStart.getTime()
    const dayEndMs = dayEnd.getTime()

    // Count messages from sessions that fall within this day
    let dayMessageCount = 0
    const daySessions = sessions.filter(
      s => s.timestamp >= dayStartMs && s.timestamp < dayEndMs
    )

    for (const session of daySessions) {
      const detail = sessionDetailsMap.get(session.sessionId)
      if (detail) {
        dayMessageCount += detail.messages.filter(
          m => m.type === 'user' || m.type === 'assistant'
        ).length
      }
    }

    dailyMessageCounts.push({
      date: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: dayMessageCount,
    })
  }

  return {
    lastDayCount,
    lastWeekCount,
    totalSessions: sessions.length,
    totalUserMessages,
    totalAssistantMessages,
    lastDayUserMessages,
    lastDayAssistantMessages,
    topProjects,
    dailyMessageCounts,
  }
}

/**
 * Stats cache class with statistics tracking
 */
class StatsCache {
  private cache = getCacheManager()
  private initialized = false
  private computing: Promise<CachedDashboardStats> | null = null
  private hitCount = 0
  private missCount = 0

  /**
   * Initialize the cache (restore from disk)
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return

    await this.cache.restore<CachedDashboardStats>(
      CACHE_NAME,
      PERSIST_FILE,
      cacheConfig.STATS_TTL,
      1 // maxSize for stats
    )
    this.initialized = true
  }

  /**
   * Get stats from cache or compute if needed
   */
  async getStats(): Promise<CachedDashboardStats> {
    await this.initialize()

    // Try to get from cache
    const cached = this.cache.get<CachedDashboardStats>(
      CACHE_NAME,
      CACHE_KEY,
      cacheConfig.STATS_TTL,
      1
    )

    if (cached) {
      // Check if cache is stale but still usable (within 2x TTL)
      const age = Date.now() - cached.cachedAt
      if (age < cacheConfig.STATS_TTL * 2) {
        this.hitCount++
        // Trigger background refresh if stale
        if (age > cacheConfig.STATS_TTL) {
          this.refreshInBackground()
        }
        return cached
      }
    }

    // Cache miss - compute fresh stats
    this.missCount++
    return this.computeAndCache()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { hitCount: number; missCount: number; hitRate: number } {
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
    }
  }

  /**
   * Reset cache statistics
   */
  resetCacheStats(): void {
    this.hitCount = 0
    this.missCount = 0
  }

  /**
   * Compute and cache stats
   */
  private async computeAndCache(): Promise<CachedDashboardStats> {
    // If already computing, wait for that
    if (this.computing) {
      return this.computing
    }

    this.computing = (async () => {
      const stats = await computeStats()
      const cachedStats: CachedDashboardStats = {
        ...stats,
        lastUpdated: Date.now(),
        cachedAt: Date.now(),
        version: CACHE_VERSION,
      }

      // Cache in memory
      this.cache.set(CACHE_NAME, CACHE_KEY, cachedStats, cacheConfig.STATS_TTL, 1)

      // Persist to disk
      await this.cache.persist(CACHE_NAME, PERSIST_FILE)

      this.computing = null
      return cachedStats
    })()

    return this.computing
  }

  /**
   * Refresh stats in the background without blocking
   */
  private refreshInBackground(): void {
    setImmediate(() => {
      this.computeAndCache().catch(error => {
        console.error('Background stats refresh failed:', error)
      })
    })
  }

  /**
   * Invalidate the cache (e.g., when new sessions are detected)
   */
  async invalidate(): Promise<void> {
    this.cache.invalidate(CACHE_KEY, CACHE_NAME)
    await this.computeAndCache()
  }

  /**
   * Force a refresh (compute and cache new stats)
   */
  async refresh(): Promise<CachedDashboardStats> {
    return this.computeAndCache()
  }
}

// Global stats cache instance
let globalStatsCache: StatsCache | null = null

/**
 * Get the global stats cache instance
 */
export function getStatsCache(): StatsCache {
  if (!globalStatsCache) {
    globalStatsCache = new StatsCache()
  }
  return globalStatsCache
}

/**
 * Invalidate stats cache
 */
export async function invalidateStatsCache(): Promise<void> {
  if (globalStatsCache) {
    await globalStatsCache.invalidate()
  }
}

/**
 * Warm the stats cache (call on server startup)
 * Triggers cache computation in the background without blocking
 */
export async function warmStatsCache(): Promise<void> {
  const cache = getStatsCache()
  // Trigger cache computation without blocking
  setImmediate(() => {
    cache.getStats().catch(error => {
      console.error('Stats cache warming failed:', error)
    })
  })
}
