import type { DataSource } from './data-source'
import type {
  SessionsResponse,
  SessionDetail,
  SearchResponse,
  SearchFilters,
  SearchFacets,
  SearchResult,
  DashboardStats,
  ProjectStats,
  Message,
  Machine,
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
import { getDb } from './db'
import { sessions, messages } from './db/schema'
import { eq, and, desc, sql, like, count, ilike, gte } from 'drizzle-orm'

export class DbDataSource implements DataSource {
  async loadSessionsList(
    userId: string,
    page: number,
    pageSize: number,
    project?: string,
    machineId?: string,
    sourceType?: string
  ): Promise<SessionsResponse> {
    const db = getDb()

    const conditions = [eq(sessions.userId, userId)]
    if (project) {
      conditions.push(eq(sessions.project, project))
    }
    if (machineId) {
      conditions.push(eq(sessions.machineId, machineId))
    }
    if (sourceType) {
      conditions.push(eq(sessions.sourceType, sourceType))
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
        sourceType: s.sourceType,
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

  async searchSessions(userId: string, filters: SearchFilters): Promise<SearchResponse> {
    const db = getDb()
    const { query, project, machineId, sourceType, messageType, toolName, dateRange } = filters

    if (!query.trim()) {
      return { results: [], total: 0, query }
    }

    // Build filter SQL conditions for session-level filters
    const filterSQLs: ReturnType<typeof sql>[] = []
    if (project) {
      filterSQLs.push(sql`s.project_name ILIKE ${'%' + project + '%'}`)
    }
    if (machineId) {
      filterSQLs.push(sql`s.machine_id = ${machineId}`)
    }
    if (sourceType) {
      filterSQLs.push(sql`s.source_type = ${sourceType}`)
    }
    if (messageType) {
      filterSQLs.push(sql`m.type = ${messageType}`)
    }
    if (toolName) {
      filterSQLs.push(sql`m.content->0->>'name' = ${toolName}`)
    }
    if (dateRange?.start) {
      filterSQLs.push(sql`m.timestamp >= ${dateRange.start}::timestamptz`)
    }
    if (dateRange?.end) {
      filterSQLs.push(sql`m.timestamp <= ${dateRange.end}::timestamptz`)
    }
    const filterSQL = filterSQLs.length > 0
      ? sql` AND ${sql.join(filterSQLs, sql` AND `)}`
      : sql``

    const tsquery = sql`plainto_tsquery('simple', ${query})`

    // Phase 1: tsvector message search
    const msgRows = await db.execute<{
      id: string; session_id: string; type: string; role: string | null;
      content: unknown; uuid: string | null; timestamp: string | null;
      sess_sid: string; display: string; project: string; project_name: string;
      source_type: string; started_at: string; message_count: number | null;
      machine_id: string | null; machine_name: string | null;
      rank: number; headline: string;
    }>(sql`
      SELECT
        m.id, m.session_id, m.type, m.role, m.content, m.uuid, m.timestamp,
        s.session_id AS sess_sid, s.display, s.project, s.project_name,
        s.source_type, s.started_at, s.message_count, s.machine_id, s.machine_name,
        ts_rank(m.search_tsvector, ${tsquery}) AS rank,
        ts_headline('simple', m.content::text, ${tsquery},
          'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
        ) AS headline
      FROM messages m
      JOIN sessions s ON m.session_id = s.id
      WHERE m.user_id = ${userId}
        AND m.search_tsvector @@ ${tsquery}
        ${filterSQL}
      ORDER BY rank DESC
      LIMIT 100
    `)

    // Build results from tsvector matches
    const seenSessions = new Set<string>()
    const results: SearchResult[] = []

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
            timestamp: new Date(row.started_at).getTime(),
            date: new Date(row.started_at).toISOString() as unknown as Date,
            messageCount: row.message_count ?? undefined,
            machineId: row.machine_id,
            machineName: row.machine_name,
            sourceType: row.source_type,
          },
          matchedMessages: [],
          relevanceScore: 0,
        })
      }

      const result = results.find((r) => r.session.sessionId === sid)!
      result.relevanceScore = Math.max(result.relevanceScore, row.rank)
      result.matchedMessages.push({
        message: {
          type: row.type,
          role: row.role,
          content: row.content,
          uuid: row.uuid ?? undefined,
          sessionId: row.sess_sid,
          timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : undefined,
        } as Message,
        snippet: row.headline || '',
        highlightRanges: [],
        headline: row.headline || undefined,
      })
    }

    // Phase 2: Search session titles (ILIKE) — only if no content-specific filters
    if (!messageType && !toolName) {
      const titleConditions = [eq(sessions.userId, userId), ilike(sessions.display, `%${query}%`)]
      if (project) titleConditions.push(ilike(sessions.projectName, `%${project}%`))
      if (machineId) titleConditions.push(eq(sessions.machineId, machineId))
      if (sourceType) titleConditions.push(eq(sessions.sourceType, sourceType))
      if (dateRange?.start) titleConditions.push(gte(sessions.startedAt, new Date(dateRange.start)))
      if (dateRange?.end) titleConditions.push(sql`${sessions.startedAt} <= ${new Date(dateRange.end)}`)

      const titleMatches = await db.query.sessions.findMany({
        where: titleConditions.length === 1 ? titleConditions[0] : and(...titleConditions),
      })

      for (const session of titleMatches) {
        if (seenSessions.has(session.sessionId)) continue
        seenSessions.add(session.sessionId)

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
            sourceType: session.sourceType,
          },
          matchedMessages: [],
          relevanceScore: 0.1,
        })
      }
    }

    results.sort((a, b) => b.relevanceScore - a.relevanceScore)

    // Phase 3: Facet queries (run in parallel)
    let facets: SearchFacets | undefined
    if (msgRows.length > 0) {
      try {
        const facetFilterSQL = filterSQLs.length > 0
          ? sql` AND ${sql.join(filterSQLs, sql` AND `)}`
          : sql``

        const [projectRows, typeRows, toolRows, sourceRows] = await Promise.all([
          db.execute<{ name: string; count: number }>(sql`
            SELECT s.project AS name, COUNT(*)::int AS count
            FROM messages m JOIN sessions s ON m.session_id = s.id,
                 ${tsquery} query
            WHERE m.user_id = ${userId}
              AND m.search_tsvector @@ query
              ${facetFilterSQL}
            GROUP BY s.project ORDER BY count DESC LIMIT 20
          `),
          db.execute<{ type: string; count: number }>(sql`
            SELECT m.type, COUNT(*)::int AS count
            FROM messages m, ${tsquery} query
            WHERE m.user_id = ${userId}
              AND m.search_tsvector @@ query
              ${facetFilterSQL}
            GROUP BY m.type ORDER BY count DESC
          `),
          db.execute<{ tool_name: string; count: number }>(sql`
            SELECT m.content->0->>'name' AS tool_name, COUNT(*)::int AS count
            FROM messages m, ${tsquery} query
            WHERE m.user_id = ${userId}
              AND m.search_tsvector @@ query
              AND m.type = 'assistant'
              ${facetFilterSQL}
            GROUP BY tool_name ORDER BY count DESC LIMIT 20
          `),
          db.execute<{ source_type: string; count: number }>(sql`
            SELECT s.source_type, COUNT(*)::int AS count
            FROM messages m JOIN sessions s ON m.session_id = s.id,
                 ${tsquery} query
            WHERE m.user_id = ${userId}
              AND m.search_tsvector @@ query
              ${facetFilterSQL}
            GROUP BY s.source_type ORDER BY count DESC
          `),
        ])

        // Get date range
        const dateRangeResult = await db.execute<{ earliest: string; latest: string }>(sql`
          SELECT
            MIN(m.timestamp)::text AS earliest,
            MAX(m.timestamp)::text AS latest
          FROM messages m, ${tsquery} query
          WHERE m.user_id = ${userId}
            AND m.search_tsvector @@ query
            ${facetFilterSQL}
        `)

        facets = {
          projects: projectRows.map((r) => ({ name: r.name, count: r.count })),
          messageTypes: typeRows.map((r) => ({ type: r.type, count: r.count })),
          toolNames: toolRows.filter((r) => r.tool_name)
            .map((r) => ({ name: r.tool_name, count: r.count })),
          sources: sourceRows.map((r) => ({ sourceType: r.source_type, count: r.count })),
          dateRange: {
            earliest: dateRangeResult[0]?.earliest || '',
            latest: dateRangeResult[0]?.latest || '',
          },
        }
      } catch (err) {
        console.warn('Facet query failed:', err)
      }
    }

    return {
      results,
      total: results.length,
      query,
      facets,
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

  async getProjects(userId: string, machineId?: string, sourceType?: string): Promise<ProjectStats[]> {
    const db = getDb()

    const conditions = [eq(sessions.userId, userId)]
    if (machineId) {
      conditions.push(eq(sessions.machineId, machineId))
    }
    if (sourceType) {
      conditions.push(eq(sessions.sourceType, sourceType))
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

  async getAnalyticsStats(userId: string, dateRange?: { start: Date; end: Date }): Promise<AnalyticsStats> {
    const db = getDb()
    const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const endDate = dateRange?.end || new Date()

    // Daily activity: group messages by day and type
    const dailyMsgData = await db
      .select({
        day: sql<string>`date_trunc('day', ${messages.timestamp})::text`,
        type: messages.type,
        count: count(),
      })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        gte(messages.timestamp, startDate),
      ))
      .groupBy(sql`date_trunc('day', ${messages.timestamp})`, messages.type)
      .orderBy(sql`date_trunc('day', ${messages.timestamp})`)

    const dailyMap = new Map<string, DailyActivityPoint>()
    for (const row of dailyMsgData) {
      const date = row.day.slice(0, 10)
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, userMessages: 0, assistantMessages: 0, toolUses: 0, sessions: 0 })
      }
      const point = dailyMap.get(date)!
      if (row.type === 'user') point.userMessages = Number(row.count)
      else if (row.type === 'assistant') point.assistantMessages = Number(row.count)
      else if (row.type === 'tool_use') point.toolUses = Number(row.count)
    }

    // Count sessions per day
    const sessionDays = await db
      .select({
        day: sql<string>`date_trunc('day', ${sessions.startedAt})::text`,
        count: count(),
      })
      .from(sessions)
      .where(and(
        eq(sessions.userId, userId),
        gte(sessions.startedAt, startDate),
      ))
      .groupBy(sql`date_trunc('day', ${sessions.startedAt})`)

    for (const row of sessionDays) {
      const date = row.day.slice(0, 10)
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { date, userMessages: 0, assistantMessages: 0, toolUses: 0, sessions: 0 })
      }
      dailyMap.get(date)!.sessions = Number(row.count)
    }

    const dailyActivity: DailyActivityPoint[] = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // Weekly activity
    const weeklyMsgData = await db
      .select({
        week: sql<string>`date_trunc('week', ${messages.timestamp})::text`,
        count: count(),
      })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        gte(messages.timestamp, startDate),
      ))
      .groupBy(sql`date_trunc('week', ${messages.timestamp})`)
      .orderBy(sql`date_trunc('week', ${messages.timestamp})`)

    const weeklySessionData = await db
      .select({
        week: sql<string>`date_trunc('week', ${sessions.startedAt})::text`,
        count: count(),
      })
      .from(sessions)
      .where(and(
        eq(sessions.userId, userId),
        gte(sessions.startedAt, startDate),
      ))
      .groupBy(sql`date_trunc('week', ${sessions.startedAt})`)

    const weeklyMap = new Map<string, { weekStart: string; totalMessages: number; sessions: number; activeDays: Set<string> }>()
    for (const row of weeklyMsgData) {
      const week = row.week.slice(0, 10)
      if (!weeklyMap.has(week)) {
        weeklyMap.set(week, { weekStart: week, totalMessages: 0, sessions: 0, activeDays: new Set() })
      }
      weeklyMap.get(week)!.totalMessages += Number(row.count)
    }
    for (const row of weeklySessionData) {
      const week = row.week.slice(0, 10)
      if (!weeklyMap.has(week)) {
        weeklyMap.set(week, { weekStart: week, totalMessages: 0, sessions: 0, activeDays: new Set() })
      }
      weeklyMap.get(week)!.sessions += Number(row.count)
    }
    for (const day of dailyMap.keys()) {
      const weekStart = day.slice(0, 10)
      if (weeklyMap.has(weekStart)) {
        weeklyMap.get(weekStart)!.activeDays.add(day)
      }
    }
    const weeklyActivity: WeeklyActivityPoint[] = Array.from(weeklyMap.values()).map(w => ({
      weekStart: w.weekStart,
      totalMessages: w.totalMessages,
      sessions: w.sessions,
      activeDays: w.activeDays.size,
    })).sort((a, b) => a.weekStart.localeCompare(b.weekStart))

    // Tool usage stats
    const toolUsageRows = await db
      .select({
        toolName: sql<string>`(${messages.content}->0->>'name')`,
        count: count(),
      })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        eq(messages.type, 'assistant'),
      ))
      .groupBy(sql`(${messages.content}->0->>'name')`)
      .orderBy(count())
      .limit(20)

    const totalToolCalls = toolUsageRows.reduce((sum, r) => sum + Number(r.count), 0)
    const toolUsageStats: ToolUsageStat[] = toolUsageRows.map(r => ({
      toolName: (r.toolName as string) || 'unknown',
      count: Number(r.count),
      percentage: totalToolCalls > 0 ? (Number(r.count) / totalToolCalls) * 100 : 0,
      trend: 'stable' as const,
    }))

    // Tool usage trend (last 14 days per tool)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const recentToolData = await db
      .select({
        day: sql<string>`date_trunc('day', ${messages.timestamp})::text`,
        content: messages.content,
      })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        eq(messages.type, 'assistant'),
        gte(messages.timestamp, fourteenDaysAgo),
      ))

    const toolTrendMap = new Map<string, Map<string, number>>()
    for (const row of recentToolData) {
      const date = row.day.slice(0, 10)
      if (Array.isArray(row.content)) {
        for (const block of row.content) {
          if (block?.type === 'tool_use' && block?.name) {
            if (!toolTrendMap.has(block.name)) {
              toolTrendMap.set(block.name, new Map())
            }
            const dayCount = toolTrendMap.get(block.name)!.get(date) || 0
            toolTrendMap.get(block.name)!.set(date, dayCount + 1)
          }
        }
      }
    }

    const toolUsageTrendDates = new Set<string>()
    for (const dayMap of toolTrendMap.values()) {
      for (const date of dayMap.keys()) {
        toolUsageTrendDates.add(date)
      }
    }
    const sortedDates = Array.from(toolUsageTrendDates).sort()
    const topTools = toolUsageStats.slice(0, 5).map(t => t.toolName)
    const toolUsageTrend: ToolUsageTrendPoint[] = sortedDates.map(date => {
      const point: ToolUsageTrendPoint = { date }
      for (const tool of topTools) {
        point[tool] = toolTrendMap.get(tool)?.get(date) || 0
      }
      return point
    })

    // Session duration stats
    const durationRows = await db
      .select({
        sessionId: sessions.sessionId,
        display: sessions.display,
        durationSeconds: sessions.durationSeconds,
      })
      .from(sessions)
      .where(and(
        eq(sessions.userId, userId),
        gte(sessions.startedAt, startDate),
      ))

    const durations = durationRows
      .filter(r => r.durationSeconds != null)
      .map(r => ({ sessionId: r.sessionId, display: r.display, minutes: Math.floor(r.durationSeconds! / 60) }))

    const avgMinutes = durations.length > 0
      ? durations.reduce((sum, d) => sum + d.minutes, 0) / durations.length
      : 0

    const sortedDurations = [...durations].sort((a, b) => a.minutes - b.minutes)
    const medianMinutes = sortedDurations.length > 0
      ? sortedDurations[Math.floor(sortedDurations.length / 2)].minutes
      : 0

    const longestSession = durations.length > 0
      ? durations.reduce((max, d) => d.minutes > max.minutes ? d : max, durations[0])
      : null

    const distribution: { range: string; count: number }[] = [
      { range: '<5m', count: 0 },
      { range: '5-15m', count: 0 },
      { range: '15-30m', count: 0 },
      { range: '30-60m', count: 0 },
      { range: '1-2h', count: 0 },
      { range: '>2h', count: 0 },
    ]
    for (const d of durations) {
      if (d.minutes < 5) distribution[0].count++
      else if (d.minutes < 15) distribution[1].count++
      else if (d.minutes < 30) distribution[2].count++
      else if (d.minutes < 60) distribution[3].count++
      else if (d.minutes < 120) distribution[4].count++
      else distribution[5].count++
    }

    const sessionDurationStats: SessionDurationStats = {
      averageMinutes: Math.round(avgMinutes * 10) / 10,
      medianMinutes,
      longestSession,
      distribution,
    }

    // Sessions by hour of day
    const hourlyRows = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${messages.timestamp})`,
        count: count(),
      })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        gte(messages.timestamp, startDate),
      ))
      .groupBy(sql`EXTRACT(HOUR FROM ${messages.timestamp})`)

    const sessionsByHourOfDay: HourOfDayStat[] = Array.from({ length: 24 }, (_, i) => {
      const row = hourlyRows.find(r => Number(r.hour) === i)
      return { hour: i, count: row ? Number(row.count) : 0 }
    })

    // Sessions by day of week
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const dowRows = await db
      .select({
        dow: sql<number>`EXTRACT(DOW FROM ${messages.timestamp})`,
        count: count(),
      })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        gte(messages.timestamp, startDate),
      ))
      .groupBy(sql`EXTRACT(DOW FROM ${messages.timestamp})`)

    const sessionsByDayOfWeek: DayOfWeekStat[] = Array.from({ length: 7 }, (_, i) => {
      const row = dowRows.find(r => Number(r.dow) === i)
      return { day: i, dayName: dayNames[i], count: row ? Number(row.count) : 0 }
    })

    // Project activity heatmap
    // Query sessions in date range
    const sessionProjects = await db
      .select({ project: sessions.project, day: sql<string>`${sessions.startedAt}::date` })
      .from(sessions)
      .where(and(
        eq(sessions.userId, userId),
        gte(sessions.startedAt, startDate),
      ))

    // Query messages in date range
    const messageProjects = await db
      .select({
        project: sessions.project,
        day: sql<string>`${messages.timestamp}::date`,
      })
      .from(messages)
      .innerJoin(sessions, eq(messages.sessionId, sessions.id))
      .where(and(
        eq(sessions.userId, userId),
        gte(sessions.startedAt, startDate),
      ))

    // Group by project and day
    const projectDayMap = new Map<string, { messages: number; sessions: Set<string> }>()
    for (const row of sessionProjects) {
      const key = `${row.project}|${row.day}`
      if (!projectDayMap.has(key)) {
        projectDayMap.set(key, { messages: 0, sessions: new Set() })
      }
      projectDayMap.get(key)!.sessions.add(row.project)
    }
    for (const row of messageProjects) {
      const key = `${row.project}|${row.day}`
      if (!projectDayMap.has(key)) {
        projectDayMap.set(key, { messages: 0, sessions: new Set() })
      }
      projectDayMap.get(key)!.messages++
    }

    const projectActivityHeatmap: ProjectHeatmapPoint[] = Array.from(projectDayMap.entries()).map(([key, val]) => {
      const [project, date] = key.split('|')
      return {
        project,
        date,
        messageCount: val.messages,
        sessionCount: val.sessions.size,
      }
    })

    // Source breakdown - get session counts and message counts separately
    const sourceSessionRows = await db
      .select({
        sourceType: sessions.sourceType,
        sessionCount: count(sessions.id),
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .groupBy(sessions.sourceType)

    const sourceMessageRows = await db
      .select({
        sourceType: sessions.sourceType,
        msgCount: count(messages.id),
      })
      .from(messages)
      .innerJoin(sessions, eq(messages.sessionId, sessions.id))
      .where(eq(sessions.userId, userId))
      .groupBy(sessions.sourceType)

    const sourceMsgMap = new Map(sourceMessageRows.map(r => [r.sourceType, Number(r.msgCount)]))
    const totalMsgs = Array.from(sourceMsgMap.values()).reduce((sum, v) => sum + v, 0)

    const sourceBreakdown: SourceBreakdown[] = sourceSessionRows.map(r => ({
      sourceType: r.sourceType,
      sessionCount: Number(r.sessionCount),
      messageCount: sourceMsgMap.get(r.sourceType) || 0,
      percentage: totalMsgs > 0 ? ((sourceMsgMap.get(r.sourceType) || 0) / totalMsgs) * 100 : 0,
    }))

    // Token estimation (heuristic: ~4 chars/token for text, ~2 chars/token for code)
    const allMsgs = await db
      .select({ content: messages.content, type: messages.type })
      .from(messages)
      .where(and(
        eq(messages.userId, userId),
        gte(messages.timestamp, startDate),
      ))

    let totalInputChars = 0
    let totalOutputChars = 0
    for (const m of allMsgs) {
      const contentStr = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      if (m.type === 'user') {
        totalInputChars += contentStr.length
      } else if (m.type === 'assistant') {
        totalOutputChars += contentStr.length
      }
    }

    // Rough heuristic
    const estimatedInputTokens = Math.floor(totalInputChars / 4)
    const estimatedOutputTokens = Math.floor(totalOutputChars / 4)
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens

    const bySourceInput = new Map<string, number>()
    const bySourceOutput = new Map<string, number>()
    const msgSourceRows = await db
      .select({
        sourceType: sessions.sourceType,
        content: messages.content,
        type: messages.type,
      })
      .from(messages)
      .innerJoin(sessions, eq(messages.sessionId, sessions.id))
      .where(and(
        eq(sessions.userId, userId),
        gte(sessions.startedAt, startDate),
      ))

    for (const r of msgSourceRows) {
      const contentStr = typeof r.content === 'string' ? r.content : JSON.stringify(r.content)
      if (r.type === 'user') {
        bySourceInput.set(r.sourceType, (bySourceInput.get(r.sourceType) || 0) + contentStr.length)
      } else if (r.type === 'assistant') {
        bySourceOutput.set(r.sourceType, (bySourceOutput.get(r.sourceType) || 0) + contentStr.length)
      }
    }

    const bySource: { sourceType: string; inputTokens: number; outputTokens: number }[] = []
    for (const st of new Set([...bySourceInput.keys(), ...bySourceOutput.keys()])) {
      bySource.push({
        sourceType: st,
        inputTokens: Math.floor((bySourceInput.get(st) || 0) / 4),
        outputTokens: Math.floor((bySourceOutput.get(st) || 0) / 4),
      })
    }

    const estimatedTokenUsage: TokenUsageEstimate = {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens,
      bySource,
      disclaimer: 'Token 数量为基于字符数的估算值，仅供参考。实际 Token 数量取决于分词方式和模型。',
    }

    return {
      dailyActivity,
      weeklyActivity,
      toolUsageStats,
      toolUsageTrend,
      sessionDurationStats,
      sessionsByHourOfDay,
      sessionsByDayOfWeek,
      projectActivityHeatmap,
      sourceBreakdown,
      estimatedTokenUsage,
    }
  }

  async getUsageAnalysis(userId: string, dateRange?: { start: Date; end: Date }): Promise<UsageAnalysisData> {
    const db = getDb()
    const startDate = (dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString()
    const endDate = (dateRange?.end || new Date()).toISOString()

    // Single query: daily stats + model summary in one pass, filtering out unknown/synthetic
    const dailyResult = await db.execute<{
      day: string
      model: string
      request_count: number
      input_tokens: string
      output_tokens: string
    }>(sql`
      SELECT
        date_trunc('day', ${messages.timestamp})::date::text AS day,
        ${messages.model} AS model,
        COUNT(*)::int AS request_count,
        COALESCE(SUM((${messages.usage}->>'inputTokens')::int), 0)::text AS input_tokens,
        COALESCE(SUM((${messages.usage}->>'outputTokens')::int), 0)::text AS output_tokens
      FROM ${messages}
      WHERE ${messages.userId} = ${userId}
        AND ${messages.type} = 'assistant'
        AND ${messages.model} IS NOT NULL
        AND ${messages.model} != '<synthetic>'
        AND ${messages.timestamp} >= ${startDate}
        AND ${messages.timestamp} <= ${endDate}
      GROUP BY date_trunc('day', ${messages.timestamp}), ${messages.model}
      ORDER BY date_trunc('day', ${messages.timestamp})
    `)

    const rows = Array.from(dailyResult)
    const models = [...new Set(rows.map(r => r.model))]
    const dates = [...new Set(rows.map(r => r.day))].sort()

    // Pivot for charts
    const requestMap = new Map<string, Map<string, number>>()
    const tokenMap = new Map<string, Map<string, number>>()
    for (const r of rows) {
      if (!requestMap.has(r.day)) requestMap.set(r.day, new Map())
      requestMap.get(r.day)!.set(r.model, Number(r.request_count))
      if (!tokenMap.has(r.day)) tokenMap.set(r.day, new Map())
      tokenMap.get(r.day)!.set(r.model, Number(r.input_tokens) + Number(r.output_tokens))
    }

    const dailyModelRequestPoints: DailyModelRequestPoint[] = dates.map(date => {
      const point: DailyModelRequestPoint = { date }
      for (const model of models) {
        point[model] = requestMap.get(date)?.get(model) || 0
      }
      return point
    })

    const dailyModelTokenPoints: DailyModelTokenPoint[] = dates.map(date => {
      const point: DailyModelTokenPoint = { date }
      for (const model of models) {
        point[model] = tokenMap.get(date)?.get(model) || 0
      }
      return point
    })

    // Model summary from same data
    const summaryMap = new Map<string, { requestCount: number; inputTokens: number; outputTokens: number }>()
    for (const r of rows) {
      const existing = summaryMap.get(r.model) || { requestCount: 0, inputTokens: 0, outputTokens: 0 }
      existing.requestCount += Number(r.request_count)
      existing.inputTokens += Number(r.input_tokens)
      existing.outputTokens += Number(r.output_tokens)
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
      dailyModelRequests: dailyModelRequestPoints,
      dailyModelTokens: dailyModelTokenPoints,
      modelSummary,
      totalRequests,
      totalTokens,
      disclaimer: '数据来自已记录的 API 响应。仅展示有模型标识的数据，不含 unknown 或 synthetic 消息。',
    }
  }
}
