import type { DataSource } from './data-source'
import type {
  SessionsResponse,
  SessionDetail,
  SearchResponse,
  DashboardStats,
  ProjectStats,
  Message,
  SearchResult,
  Machine,
} from './types'
import { getDb } from './db'
import { sessions, messages } from './db/schema'
import { eq, and, desc, sql, like, count, ilike, gte } from 'drizzle-orm'

export class DbDataSource implements DataSource {
  async loadSessionsList(
    userId: string,
    page: number,
    pageSize: number,
    project?: string,
    machineId?: string
  ): Promise<SessionsResponse> {
    const db = getDb()

    const conditions = [eq(sessions.userId, userId)]
    if (project) {
      conditions.push(eq(sessions.project, project))
    }
    if (machineId) {
      conditions.push(eq(sessions.machineId, machineId))
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions)

    const [totalResult] = await db
      .select({ count: count() })
      .from(sessions)
      .where(where)

    const total = totalResult?.count ?? 0

    const rows = await db.query.sessions.findMany({
      where,
      orderBy: [desc(sessions.startedAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })

    return {
      sessions: rows.map((s) => ({
        sessionId: s.sessionId,
        display: s.display,
        project: s.project,
        projectName: s.projectName,
        timestamp: s.startedAt.getTime(),
        date: s.startedAt.toISOString(),
        messageCount: s.messageCount ?? undefined,
        machineId: s.machineId,
        machineName: s.machineName,
      })),
      total,
      page,
      pageSize,
    }
  }

  async loadSessionDetail(userId: string, sessionId: string): Promise<SessionDetail | null> {
    const db = getDb()

    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.userId, userId),
        eq(sessions.sessionId, sessionId),
      ),
    })

    if (!session) return null

    const msgs = await db.query.messages.findMany({
      where: eq(messages.sessionId, session.id),
      orderBy: [messages.timestamp],
    })

    return {
      session: {
        sessionId: session.sessionId,
        display: session.display,
        project: session.project,
        projectName: session.projectName,
        timestamp: session.startedAt.getTime(),
        date: session.startedAt.toISOString() as unknown as Date,
        messageCount: session.messageCount ?? undefined,
        machineId: session.machineId,
        machineName: session.machineName,
      },
      messages: msgs.map((m) => ({
        type: m.type,
        role: m.role,
        content: m.content,
        uuid: m.uuid ?? undefined,
        sessionId: session.sessionId,
        timestamp: m.timestamp?.toISOString(),
      } as Message)),
      projectPath: session.project,
    }
  }

  async searchSessions(userId: string, keyword: string, filters?: { project?: string; machineId?: string }): Promise<SearchResponse> {
    const db = getDb()

    // Build session-level filter conditions
    const sessionConditions = [eq(sessions.userId, userId)]
    if (filters?.machineId) {
      sessionConditions.push(eq(sessions.machineId, filters.machineId))
    }
    if (filters?.project) {
      sessionConditions.push(ilike(sessions.projectName, `%${filters.project}%`))
    }

    // Search in messages using ILIKE for text search
    const matchingMessages = await db.query.messages.findMany({
      where: and(
        eq(messages.userId, userId),
        ilike(messages.searchVector, `%${keyword}%`),
      ),
      limit: 1000,
    })

    // Get unique session IDs, then filter by machine/project
    const sessionIds = new Set(matchingMessages.map((m) => m.sessionId))

    const results: SearchResult[] = []

    const sessionFilterWhere = sessionConditions.length === 1 ? sessionConditions[0] : and(...sessionConditions)

    for (const sid of sessionIds) {
      const session = await db.query.sessions.findFirst({
        where: and(eq(sessions.id, sid), sessionFilterWhere),
      })

      if (!session) continue

      const sessionMessages = matchingMessages.filter((m) => m.sessionId === sid)
      const matchedMessages = sessionMessages.map((m) => {
        const contentStr = typeof m.content === 'string'
          ? m.content
          : JSON.stringify(m.content)
        const lowerContent = contentStr.toLowerCase()
        const lowerKeyword = keyword.toLowerCase()
        const idx = lowerContent.indexOf(lowerKeyword)

        let snippet = ''
        if (idx >= 0) {
          const start = Math.max(0, idx - 50)
          const end = Math.min(contentStr.length, idx + keyword.length + 50)
          snippet = (start > 0 ? '...' : '') + contentStr.slice(start, end) + (end < contentStr.length ? '...' : '')
        }

        return {
          message: {
            type: m.type,
            role: m.role,
            content: m.content,
            uuid: m.uuid ?? undefined,
            sessionId: session.sessionId,
            timestamp: m.timestamp?.toISOString(),
          } as Message,
          snippet,
          highlightRanges: idx >= 0 ? [{ start: Math.max(0, idx - 50), end: Math.max(0, idx - 50) + keyword.length }] : [],
        }
      })

      // Also check if title matches
      const titleMatch = session.display.toLowerCase().includes(keyword.toLowerCase())

      results.push({
        session: {
          sessionId: session.sessionId,
          display: session.display,
          project: session.project,
          projectName: session.projectName,
          timestamp: session.startedAt.getTime(),
          date: session.startedAt.toISOString() as unknown as Date,
          messageCount: session.messageCount ?? undefined,
          machineId: session.machineId,
          machineName: session.machineName,
        },
        matchedMessages,
        relevanceScore: matchedMessages.length + (titleMatch ? 1 : 0),
      })
    }

    // Also search session titles
    const titleWhereConditions = [
      eq(sessions.userId, userId),
      ilike(sessions.display, `%${keyword}%`),
    ]
    if (filters?.machineId) {
      titleWhereConditions.push(eq(sessions.machineId, filters.machineId))
    }
    if (filters?.project) {
      titleWhereConditions.push(ilike(sessions.projectName, `%${filters.project}%`))
    }
    const titleMatches = await db.query.sessions.findMany({
      where: and(...titleWhereConditions),
    })

    for (const session of titleMatches) {
      if (results.some((r) => r.session.sessionId === session.sessionId)) continue

      results.push({
        session: {
          sessionId: session.sessionId,
          display: session.display,
          project: session.project,
          projectName: session.projectName,
          timestamp: session.startedAt.getTime(),
          date: session.startedAt.toISOString() as unknown as Date,
          messageCount: session.messageCount ?? undefined,
          machineId: session.machineId,
          machineName: session.machineName,
        },
        matchedMessages: [],
        relevanceScore: 1,
      })
    }

    results.sort((a, b) => b.relevanceScore - a.relevanceScore)

    return {
      results,
      total: results.length,
      query: keyword,
    }
  }

  async getDashboardStats(userId: string): Promise<DashboardStats> {
    const db = getDb()

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [totalSessions] = await db
      .select({ count: count() })
      .from(sessions)
      .where(eq(sessions.userId, userId))

    const [lastDaySessions] = await db
      .select({ count: count() })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gte(sessions.startedAt, oneDayAgo)))

    const [lastWeekSessions] = await db
      .select({ count: count() })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gte(sessions.startedAt, oneWeekAgo)))

    // Message counts
    const [totalMsgs] = await db
      .select({ count: count() })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        eq(messages.type, 'user'),
      ))

    const [totalAssistantMsgs] = await db
      .select({ count: count() })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        eq(messages.type, 'assistant'),
      ))

    const [lastDayUserMsgs] = await db
      .select({ count: count() })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        eq(messages.type, 'user'),
        gte(messages.timestamp, oneDayAgo),
      ))

    const [lastDayAssistantMsgs] = await db
      .select({ count: count() })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        eq(messages.type, 'assistant'),
        gte(messages.timestamp, oneDayAgo),
      ))

    // Top projects
    const allSessions = await db.query.sessions.findMany({
      where: eq(sessions.userId, userId),
      orderBy: [desc(sessions.startedAt)],
    })

    const projectMap = new Map<string, ProjectStats>()
    for (const s of allSessions) {
      if (!projectMap.has(s.project)) {
        projectMap.set(s.project, {
          project: s.project,
          projectName: s.projectName,
          totalSessions: 0,
          lastUpdate: s.startedAt.getTime(),
          recentSessions: 0,
        })
      }
      const stats = projectMap.get(s.project)!
      stats.totalSessions++
      if (s.startedAt.getTime() > stats.lastUpdate) {
        stats.lastUpdate = s.startedAt.getTime()
      }
      if (s.startedAt >= oneWeekAgo) {
        stats.recentSessions++
      }
    }

    // Daily message counts for last 30 days
    const dailyCounts = await db
      .select({
        date: sql<string>`date_trunc('day', ${messages.timestamp})::text`,
        count: count(),
      })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        gte(messages.timestamp, thirtyDaysAgo),
      ))
      .groupBy(sql`date_trunc('day', ${messages.timestamp})`)
      .orderBy(sql`date_trunc('day', ${messages.timestamp})`)

    return {
      lastDayCount: lastDaySessions?.count ?? 0,
      lastWeekCount: lastWeekSessions?.count ?? 0,
      totalSessions: totalSessions?.count ?? 0,
      totalUserMessages: totalMsgs?.count ?? 0,
      totalAssistantMessages: totalAssistantMsgs?.count ?? 0,
      lastDayUserMessages: lastDayUserMsgs?.count ?? 0,
      lastDayAssistantMessages: lastDayAssistantMsgs?.count ?? 0,
      topProjects: Array.from(projectMap.values())
        .sort((a, b) => b.totalSessions - a.totalSessions)
        .slice(0, 10),
      dailyMessageCounts: dailyCounts.map((d) => ({
        date: d.date.slice(0, 10),
        count: d.count,
      })),
    }
  }

  async getProjects(userId: string, machineId?: string): Promise<ProjectStats[]> {
    const db = getDb()

    const conditions = [eq(sessions.userId, userId)]
    if (machineId) {
      conditions.push(eq(sessions.machineId, machineId))
    }
    const where = conditions.length === 1 ? conditions[0] : and(...conditions)

    const allSessions = await db.query.sessions.findMany({
      where,
      orderBy: [desc(sessions.lastMessageAt)],
    })

    const projectMap = new Map<string, ProjectStats>()
    for (const s of allSessions) {
      if (!projectMap.has(s.project)) {
        projectMap.set(s.project, {
          project: s.project,
          projectName: s.projectName,
          totalSessions: 0,
          lastUpdate: s.lastMessageAt?.getTime() ?? s.startedAt.getTime(),
          recentSessions: 0,
        })
      }
      const stats = projectMap.get(s.project)!
      stats.totalSessions++
      const ts = s.lastMessageAt?.getTime() ?? s.startedAt.getTime()
      if (ts > stats.lastUpdate) {
        stats.lastUpdate = ts
      }
    }

    return Array.from(projectMap.values())
      .sort((a, b) => b.lastUpdate - a.lastUpdate)
  }

  async getMachines(userId: string): Promise<Machine[]> {
    const db = getDb()

    const rows = await db
      .select({
        machineId: sessions.machineId,
        machineName: sessions.machineName,
        count: count(),
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .groupBy(sessions.machineId, sessions.machineName)

    return rows
      .filter((r) => r.machineId != null)
      .map((r) => ({
        machineId: r.machineId!,
        machineName: r.machineName || r.machineId!,
        sessionCount: r.count,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount)
  }
}
