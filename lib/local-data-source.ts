import type { DataSource } from './data-source'
import type {
  SessionsResponse,
  SessionDetail,
  SearchResponse,
  SearchFilters,
  DashboardStats,
  ProjectStats,
  Machine,
  AnalyticsStats,
} from './types'
import { loadSessionsList, loadSessionDetail, searchSessions } from './claude-history'
import { getSessionCache } from './session-cache'
import { getStatsCache, warmStatsCache } from './stats-cache'
import { startFileWatcher } from './file-watcher'

export class LocalDataSource implements DataSource {
  async loadSessionsList(
    _userId: string,
    page: number,
    pageSize: number,
    project?: string,
    _machineId?: string,
    _sourceType?: string
  ): Promise<SessionsResponse> {
    startFileWatcher()
    const sessionCache = getSessionCache()
    let sessions = await sessionCache.getSessionList()

    if (project) {
      sessions = sessions.filter((s) => s.project === project)
    }

    const total = sessions.length
    const start = (page - 1) * pageSize
    const paginatedSessions = sessions.slice(start, start + pageSize)

    return {
      sessions: paginatedSessions.map((s) => ({
        ...s,
        date: s.date.toISOString(),
      })),
      total,
      page,
      pageSize,
    }
  }

  async loadSessionDetail(_userId: string, sessionId: string): Promise<SessionDetail | null> {
    startFileWatcher()
    const sessionCache = getSessionCache()
    const detail = await sessionCache.getSessionDetail(sessionId)
    if (!detail) return null

    return {
      ...detail,
      session: {
        ...detail.session,
        date: detail.session.date.toISOString(),
      },
    } as SessionDetail & { session: { date: string } }
  }

  async searchSessions(_userId: string, filters: SearchFilters): Promise<SearchResponse> {
    const results = await searchSessions(filters.query)
    return {
      results,
      total: results.length,
      query: filters.query,
    }
  }

  async getDashboardStats(_userId: string): Promise<DashboardStats> {
    startFileWatcher()
    warmStatsCache()
    const statsCache = getStatsCache()
    return statsCache.getStats()
  }

  async getProjects(_userId: string, _machineId?: string, _sourceType?: string): Promise<ProjectStats[]> {
    startFileWatcher()
    const sessions = await loadSessionsList()

    const projectMap = new Map<string, ProjectStats>()
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
      if (session.timestamp > stats.lastUpdate) {
        stats.lastUpdate = session.timestamp
      }
    }

    return Array.from(projectMap.values()).sort((a, b) => b.lastUpdate - a.lastUpdate)
  }

  async getMachines(_userId: string): Promise<Machine[]> {
    return []
  }

  async getAnalyticsStats(_userId: string, _dateRange?: { start: Date; end: Date }): Promise<AnalyticsStats> {
    // Local mode doesn't support full analytics - return empty/default stats
    return {
      dailyActivity: [],
      weeklyActivity: [],
      toolUsageStats: [],
      toolUsageTrend: [],
      sessionDurationStats: {
        averageMinutes: 0,
        medianMinutes: 0,
        longestSession: null,
        distribution: [],
      },
      sessionsByHourOfDay: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
      sessionsByDayOfWeek: [
        { day: 0, dayName: '周日', count: 0 },
        { day: 1, dayName: '周一', count: 0 },
        { day: 2, dayName: '周二', count: 0 },
        { day: 3, dayName: '周三', count: 0 },
        { day: 4, dayName: '周四', count: 0 },
        { day: 5, dayName: '周五', count: 0 },
        { day: 6, dayName: '周六', count: 0 },
      ],
      projectActivityHeatmap: [],
      sourceBreakdown: [],
      estimatedTokenUsage: {
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedTotalTokens: 0,
        bySource: [],
        disclaimer: '本地模式下不支持 Token 估算',
      },
    }
  }
}
