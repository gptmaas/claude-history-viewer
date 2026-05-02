import type { DataSource } from './data-source'
import type {
  SessionsResponse,
  SessionDetail,
  SearchResponse,
  DashboardStats,
  ProjectStats,
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
    project?: string
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

  async searchSessions(_userId: string, keyword: string): Promise<SearchResponse> {
    const results = await searchSessions(keyword)
    return {
      results,
      total: results.length,
      query: keyword,
    }
  }

  async getDashboardStats(_userId: string): Promise<DashboardStats> {
    startFileWatcher()
    warmStatsCache()
    const statsCache = getStatsCache()
    return statsCache.getStats()
  }

  async getProjects(_userId: string): Promise<ProjectStats[]> {
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
}
