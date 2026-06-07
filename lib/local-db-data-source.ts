import type { DataSource } from './data-source'
import type {
  SessionsResponse,
  SessionDetail,
  SearchResponse,
  SearchFilters,
  DashboardStats,
  ProjectStats,
  Message,
  AnalyticsStats,
  DailyActivityPoint,
  WeeklyActivityPoint,
  ToolUsageStat,
  ToolUsageTrendPoint,
  SessionDurationStats,
  HourOfDayStat,
  DayOfWeekStat,
  ProjectHeatmapPoint,
  SourceBreakdown,
  TokenUsageEstimate,
  UsageAnalysisData,
  DailyModelRequestPoint,
  DailyModelTokenPoint,
  ModelUsageSummary,
} from './types'
import { getDb, getRawDb } from './local-db/index'
import { localSessions, localMessages, localSources } from './local-db/schema'
import { eq, and, desc, sql, like, count, gte } from 'drizzle-orm'

export class SqliteDataSource implements DataSource {
  private db() { return getDb() }
  private raw() { return getRawDb() }

  async loadSessionsList(
    _userId: string,
    page: number,
    pageSize: number,
    project?: string,
    _machineId?: string,
    sourceType?: string
  ): Promise<SessionsResponse> {
    const db = this.db()

    const conditions = []
    if (project) conditions.push(eq(localSessions.project, project))
    if (sourceType) conditions.push(eq(localSessions.sourceType, sourceType))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [totalResult] = await db
      .select({ count: count() })
      .from(localSessions)
      .where(where)

    const total = totalResult?.count ?? 0

    const rows = await db.query.localSessions.findMany({
      where,
      orderBy: [desc(localSessions.startedAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })

    return {
      sessions: rows.map((s) => ({
        sessionId: s.sessionId,
        display: s.display ?? '',
        project: s.project ?? '',
        projectName: s.projectName ?? '',
        timestamp: s.startedAt,
        date: new Date(s.startedAt).toISOString(),
        messageCount: s.messageCount ?? undefined,
        sourceType: s.sourceType,
      })),
      total,
      page,
      pageSize,
    }
  }

  async loadSessionDetail(_userId: string, sessionId: string): Promise<SessionDetail | null> {
    const db = this.db()

    const session = await db.query.localSessions.findFirst({
      where: eq(localSessions.sessionId, sessionId),
    })
    if (!session) return null

    const msgs = await db.query.localMessages.findMany({
      where: eq(localMessages.sessionId, session.id),
      orderBy: [localMessages.timestamp],
    })

    return {
      session: {
        sessionId: session.sessionId,
        display: session.display ?? '',
        project: session.project ?? '',
        projectName: session.projectName ?? '',
        timestamp: session.startedAt,
        date: new Date(session.startedAt).toISOString() as unknown as Date,
        messageCount: session.messageCount ?? undefined,
      },
      messages: msgs.map((m) => ({
        type: m.type,
        role: m.role ?? undefined,
        content: m.content,
        uuid: m.uuid ?? undefined,
        sessionId: session.sessionId,
        timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : undefined,
      } as Message)),
      projectPath: session.project ?? '',
    }
  }

  async searchSessions(_userId: string, filters: SearchFilters): Promise<SearchResponse> {
    const raw = this.raw()
    const { query, project, sourceType, dateRange } = filters

    if (!query.trim()) {
      return { results: [], total: 0, query }
    }

    const conditions: string[] = []
    if (project) conditions.push(`s.project LIKE '%${project.replace(/'/g, "''")}%'`)
    if (sourceType) conditions.push(`s.source_type = '${sourceType.replace(/'/g, "''")}'`)
    if (dateRange?.start) conditions.push(`m.timestamp >= ${new Date(dateRange.start).getTime()}`)
    if (dateRange?.end) conditions.push(`m.timestamp <= ${new Date(dateRange.end).getTime()}`)
    const filterSQL = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : ''

    // FTS5 search
    const escapedQuery = query.replace(/"/g, '""')
    const msgRows = raw.prepare(`
      SELECT
        m.id, m.session_id, m.type, m.role, m.content, m.uuid, m.timestamp,
        s.session_id AS sess_sid, s.display, s.project, s.project_name,
        s.source_type, s.started_at, s.message_count,
        rank
      FROM local_messages_fts fts
      JOIN local_messages m ON m.id = fts.rowid
      JOIN local_sessions s ON m.session_id = s.id
      WHERE local_messages_fts MATCH ?
      ${filterSQL}
      ORDER BY rank
      LIMIT 100
    `).all(`"${escapedQuery}"`) as Array<{
      id: number; session_id: number; type: string; role: string | null;
      content: unknown; uuid: string | null; timestamp: number | null;
      sess_sid: string; display: string; project: string; project_name: string;
      source_type: string; started_at: number; message_count: number | null;
      rank: number;
    }>

    const seenSessions = new Set<string>()
    const results: SearchResponse['results'] = []

    for (const row of msgRows) {
      const sid = row.sess_sid
      if (!seenSessions.has(sid)) {
        seenSessions.add(sid)
        results.push({
          session: {
            sessionId: row.sess_sid,
            display: row.display,
            project: row.project,
            projectName: row.project_name,
            timestamp: row.started_at,
            date: new Date(row.started_at).toISOString() as unknown as Date,
            messageCount: row.message_count ?? undefined,
            sourceType: row.source_type,
          },
          matchedMessages: [],
          relevanceScore: -row.rank,
        })
      }

      const result = results.find((r) => r.session.sessionId === sid)!
      const contentStr = typeof row.content === 'string' ? row.content : JSON.stringify(row.content)
      const snippet = extractSnippet(contentStr, query, 200)

      result.matchedMessages.push({
        message: {
          type: row.type,
          role: row.role ?? undefined,
          content: row.content,
          uuid: row.uuid ?? undefined,
          sessionId: row.sess_sid,
          timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : undefined,
        } as Message,
        snippet,
        highlightRanges: [],
      })
    }

    // Fallback: search session titles
    const escapedLike = `%${query.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
    const titleRows = raw.prepare(`
      SELECT session_id, display, project, project_name, source_type, started_at, message_count
      FROM local_sessions
      WHERE display LIKE ? ESCAPE '\\'
    `).all(escapedLike) as Array<{
      session_id: string; display: string; project: string; project_name: string;
      source_type: string; started_at: number; message_count: number | null;
    }>

    for (const row of titleRows) {
      if (seenSessions.has(row.session_id)) continue
      seenSessions.add(row.session_id)
      results.push({
        session: {
          sessionId: row.session_id,
          display: row.display,
          project: row.project,
          projectName: row.project_name,
          timestamp: row.started_at,
          date: new Date(row.started_at).toISOString() as unknown as Date,
          messageCount: row.message_count ?? undefined,
          sourceType: row.source_type,
        },
        matchedMessages: [],
        relevanceScore: 0.1,
      })
    }

    results.sort((a, b) => b.relevanceScore - a.relevanceScore)

    return { results, total: results.length, query }
  }

  async getDashboardStats(_userId: string): Promise<DashboardStats> {
    const raw = this.raw()
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    const totalSessions = (raw.prepare('SELECT COUNT(*) as c FROM local_sessions').get() as { c: number }).c
    const lastDayCount = (raw.prepare('SELECT COUNT(*) as c FROM local_sessions WHERE started_at >= ?').get(oneDayAgo) as { c: number }).c
    const lastWeekCount = (raw.prepare('SELECT COUNT(*) as c FROM local_sessions WHERE started_at >= ?').get(oneWeekAgo) as { c: number }).c

    const totalUserMsgs = (raw.prepare("SELECT COUNT(*) as c FROM local_messages WHERE type = 'user'").get() as { c: number }).c
    const totalAssistantMsgs = (raw.prepare("SELECT COUNT(*) as c FROM local_messages WHERE type = 'assistant'").get() as { c: number }).c
    const lastDayUserMsgs = (raw.prepare("SELECT COUNT(*) as c FROM local_messages WHERE type = 'user' AND timestamp >= ?").get(oneDayAgo) as { c: number }).c
    const lastDayAssistantMsgs = (raw.prepare("SELECT COUNT(*) as c FROM local_messages WHERE type = 'assistant' AND timestamp >= ?").get(oneDayAgo) as { c: number }).c

    // Top projects
    const projectRows = raw.prepare(`
      SELECT project, project_name, COUNT(*) as total_sessions, MAX(started_at) as last_update
      FROM local_sessions GROUP BY project ORDER BY total_sessions DESC LIMIT 10
    `).all() as Array<{ project: string; project_name: string; total_sessions: number; last_update: number }>

    const topProjects: ProjectStats[] = projectRows.map((r) => ({
      project: r.project,
      projectName: r.project_name,
      totalSessions: r.total_sessions,
      lastUpdate: r.last_update,
      recentSessions: 0,
    }))

    // Daily message counts
    const dailyCounts = raw.prepare(`
      SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as date, COUNT(*) as count
      FROM local_messages WHERE timestamp >= ?
      GROUP BY date ORDER BY date
    `).all(thirtyDaysAgo) as Array<{ date: string; count: number }>

    return {
      lastDayCount,
      lastWeekCount,
      totalSessions,
      totalUserMessages: totalUserMsgs,
      totalAssistantMessages: totalAssistantMsgs,
      lastDayUserMessages: lastDayUserMsgs,
      lastDayAssistantMessages: lastDayAssistantMsgs,
      topProjects,
      dailyMessageCounts: dailyCounts.map((d) => ({ date: d.date, count: d.count })),
    }
  }

  async getProjects(_userId: string, _machineId?: string, sourceType?: string): Promise<ProjectStats[]> {
    const raw = this.raw()

    const typeFilter = sourceType ? ` AND source_type = '${sourceType.replace(/'/g, "''")}'` : ''
    const rows = raw.prepare(`
      SELECT project, project_name, COUNT(*) as total_sessions, MAX(last_message_at) as last_update
      FROM local_sessions WHERE 1=1 ${typeFilter}
      GROUP BY project ORDER BY last_update DESC
    `).all() as Array<{ project: string; project_name: string; total_sessions: number; last_update: number | null }>

    return rows.map((r) => ({
      project: r.project,
      projectName: r.project_name,
      totalSessions: r.total_sessions,
      lastUpdate: r.last_update ?? 0,
      recentSessions: 0,
    }))
  }

  async getMachines(_userId: string): Promise<import('./types').Machine[]> {
    return []
  }

  async getAnalyticsStats(_userId: string, dateRange?: { start: Date; end: Date }): Promise<AnalyticsStats> {
    const raw = this.raw()
    const startMs = dateRange?.start?.getTime() ?? Date.now() - 30 * 24 * 60 * 60 * 1000
    const endMs = dateRange?.end?.getTime() ?? Date.now()

    // Daily activity
    const dailyMsgRows = raw.prepare(`
      SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as day, type, COUNT(*) as count
      FROM local_messages WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY day, type ORDER BY day
    `).all(startMs, endMs) as Array<{ day: string; type: string; count: number }>

    const dailyMap = new Map<string, DailyActivityPoint>()
    for (const row of dailyMsgRows) {
      if (!dailyMap.has(row.day)) {
        dailyMap.set(row.day, { date: row.day, userMessages: 0, assistantMessages: 0, toolUses: 0, sessions: 0 })
      }
      const point = dailyMap.get(row.day)!
      if (row.type === 'user') point.userMessages = row.count
      else if (row.type === 'assistant') point.assistantMessages = row.count
      else if (row.type === 'tool_use') point.toolUses = row.count
    }

    const sessionDayRows = raw.prepare(`
      SELECT strftime('%Y-%m-%d', started_at / 1000, 'unixepoch') as day, COUNT(*) as count
      FROM local_sessions WHERE started_at >= ? AND started_at <= ?
      GROUP BY day
    `).all(startMs, endMs) as Array<{ day: string; count: number }>

    for (const row of sessionDayRows) {
      if (!dailyMap.has(row.day)) {
        dailyMap.set(row.day, { date: row.day, userMessages: 0, assistantMessages: 0, toolUses: 0, sessions: 0 })
      }
      dailyMap.get(row.day)!.sessions = row.count
    }

    const dailyActivity = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // Sessions by hour
    const hourlyRows = raw.prepare(`
      SELECT CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) as hour, COUNT(*) as count
      FROM local_messages WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY hour
    `).all(startMs, endMs) as Array<{ hour: number; count: number }>

    const sessionsByHourOfDay: HourOfDayStat[] = Array.from({ length: 24 }, (_, i) => {
      const row = hourlyRows.find((r) => r.hour === i)
      return { hour: i, count: row?.count ?? 0 }
    })

    // Sessions by day of week
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const dowRows = raw.prepare(`
      SELECT CAST(strftime('%w', timestamp / 1000, 'unixepoch') AS INTEGER) as dow, COUNT(*) as count
      FROM local_messages WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY dow
    `).all(startMs, endMs) as Array<{ dow: number; count: number }>

    const sessionsByDayOfWeek: DayOfWeekStat[] = Array.from({ length: 7 }, (_, i) => {
      const row = dowRows.find((r) => r.dow === i)
      return { day: i, dayName: dayNames[i], count: row?.count ?? 0 }
    })

    // Source breakdown
    const sourceRows = raw.prepare(`
      SELECT s.source_type, COUNT(DISTINCT s.id) as session_count, COUNT(m.id) as message_count
      FROM local_sessions s LEFT JOIN local_messages m ON m.session_id = s.id
      GROUP BY s.source_type
    `).all() as Array<{ source_type: string; session_count: number; message_count: number }>

    const totalMsgs = sourceRows.reduce((sum, r) => sum + r.message_count, 0)
    const sourceBreakdown: SourceBreakdown[] = sourceRows.map((r) => ({
      sourceType: r.source_type,
      sessionCount: r.session_count,
      messageCount: r.message_count,
      percentage: totalMsgs > 0 ? (r.message_count / totalMsgs) * 100 : 0,
    }))

    return {
      dailyActivity,
      weeklyActivity: [],
      toolUsageStats: [],
      toolUsageTrend: [],
      sessionDurationStats: {
        averageMinutes: 0,
        medianMinutes: 0,
        longestSession: null,
        distribution: [],
      },
      sessionsByHourOfDay,
      sessionsByDayOfWeek,
      projectActivityHeatmap: [],
      sourceBreakdown,
      estimatedTokenUsage: {
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedTotalTokens: 0,
        bySource: [],
        disclaimer: '本地桌面模式的 Token 估算暂未实现',
      },
    }
  }

  async getUsageAnalysis(_userId: string, dateRange?: { start: Date; end: Date }): Promise<UsageAnalysisData> {
    const raw = this.raw()
    const startMs = dateRange?.start?.getTime() ?? Date.now() - 30 * 24 * 60 * 60 * 1000
    const endMs = dateRange?.end?.getTime() ?? Date.now()

    const rows = raw.prepare(`
      SELECT
        strftime('%Y-%m-%d', m.timestamp / 1000, 'unixepoch') as day,
        m.model,
        COUNT(*) as request_count,
        COALESCE(CAST(json_extract(m.usage, '$.inputTokens') AS INTEGER), 0) as input_tokens,
        COALESCE(CAST(json_extract(m.usage, '$.outputTokens') AS INTEGER), 0) as output_tokens
      FROM local_messages m
      WHERE m.type = 'assistant' AND m.model IS NOT NULL AND m.model != '<synthetic>'
        AND m.timestamp >= ? AND m.timestamp <= ?
      GROUP BY day, m.model
      ORDER BY day
    `).all(startMs, endMs) as Array<{
      day: string; model: string; request_count: number;
      input_tokens: number; output_tokens: number;
    }>

    const models = [...new Set(rows.map((r) => r.model))]
    const dates = [...new Set(rows.map((r) => r.day))].sort()

    const requestMap = new Map<string, Map<string, number>>()
    const tokenMap = new Map<string, Map<string, number>>()
    for (const r of rows) {
      if (!requestMap.has(r.day)) requestMap.set(r.day, new Map())
      requestMap.get(r.day)!.set(r.model, r.request_count)
      if (!tokenMap.has(r.day)) tokenMap.set(r.day, new Map())
      tokenMap.get(r.day)!.set(r.model, r.input_tokens + r.output_tokens)
    }

    const dailyModelRequests: DailyModelRequestPoint[] = dates.map((date) => {
      const point: DailyModelRequestPoint = { date }
      for (const model of models) {
        point[model] = requestMap.get(date)?.get(model) || 0
      }
      return point
    })

    const dailyModelTokens: DailyModelTokenPoint[] = dates.map((date) => {
      const point: DailyModelTokenPoint = { date }
      for (const model of models) {
        point[model] = tokenMap.get(date)?.get(model) || 0
      }
      return point
    })

    const summaryMap = new Map<string, { requestCount: number; inputTokens: number; outputTokens: number }>()
    for (const r of rows) {
      const existing = summaryMap.get(r.model) || { requestCount: 0, inputTokens: 0, outputTokens: 0 }
      existing.requestCount += r.request_count
      existing.inputTokens += r.input_tokens
      existing.outputTokens += r.output_tokens
      summaryMap.set(r.model, existing)
    }

    const totalRequests = [...summaryMap.values()].reduce((s, v) => s + v.requestCount, 0)
    const totalTokens = [...summaryMap.values()].reduce((s, v) => s + v.inputTokens + v.outputTokens, 0)

    const modelSummary: ModelUsageSummary[] = [...summaryMap.entries()]
      .sort((a, b) => b[1].requestCount - a[1].requestCount)
      .map(([model, v]) => ({
        model,
        requestCount: v.requestCount,
        inputTokens: v.inputTokens,
        outputTokens: v.outputTokens,
        totalTokens: v.inputTokens + v.outputTokens,
        percentage: totalRequests > 0 ? (v.requestCount / totalRequests) * 100 : 0,
      }))

    return {
      dailyModelRequests: dailyModelRequests,
      dailyModelTokens: dailyModelTokens,
      modelSummary,
      totalRequests,
      totalTokens,
      disclaimer: '数据来自已记录的 API 响应。仅展示有模型标识的数据。',
    }
  }
}

function extractSnippet(text: string, query: string, maxLen: number): string {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen)
  const start = Math.max(0, idx - maxLen / 2)
  const end = Math.min(text.length, start + maxLen)
  return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
}
