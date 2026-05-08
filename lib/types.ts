// Session list entry from history.jsonl
export interface SessionListEntry {
  display: string
  pastedContents: Record<string, unknown>
  timestamp: number
  project: string
  sessionId: string
}

// Session with computed fields
export interface Session {
  sessionId: string
  display: string
  project: string
  projectName: string
  timestamp: number
  date: Date
  messageCount?: number
  machineId?: string | null
  machineName?: string | null
  sourceType?: string | null
}

// Message types from session detail JSONL
export type MessageType = 'user' | 'assistant' | 'system' | 'file-history-snapshot' | 'tool_use' | 'tool_result'

export interface BaseMessage {
  type: MessageType
  timestamp?: string
  uuid?: string
  sessionId?: string
}

export interface UserMessage extends BaseMessage {
  type: 'user'
  role: 'user'
  content: string | unknown
  uuid: string
  sessionId: string
  cwd?: string
  gitBranch?: string
}

export interface AssistantMessage extends BaseMessage {
  type: 'assistant'
  role: 'assistant'
  content: string | unknown
  uuid: string
  sessionId: string
}

export interface SystemMessage extends BaseMessage {
  type: 'system'
  content: string
}

export interface FileHistorySnapshot extends BaseMessage {
  type: 'file-history-snapshot'
  messageId: string
  snapshot: {
    messageId: string
    trackedFileBackups: Record<string, unknown>
    timestamp: string
  }
  isSnapshotUpdate: boolean
}

export interface ToolUseMessage extends BaseMessage {
  type: 'tool_use'
  content: string | unknown
  uuid: string
  sessionId: string
}

export interface ToolResultMessage extends BaseMessage {
  type: 'tool_result'
  content: string | unknown
  uuid: string
  sessionId: string
}

export type Message = UserMessage | AssistantMessage | SystemMessage | FileHistorySnapshot | ToolUseMessage | ToolResultMessage

// Full session detail
export interface SessionDetail {
  session: Session
  messages: Message[]
  projectPath: string
}

// Search result
export interface SearchResult {
  session: Session
  matchedMessages: Array<{
    message: Message
    snippet: string
    highlightRanges: Array<{ start: number; end: number }>
  }>
  relevanceScore: number
}

// Export formats
export type ExportFormat = 'md' | 'json' | 'html'

// API response types (with Date serialized as ISO string)
export interface SessionWithISODate {
  sessionId: string
  display: string
  project: string
  projectName: string
  timestamp: number
  date: string  // ISO string for JSON serialization
  messageCount?: number
  machineId?: string | null
  machineName?: string | null
}

export interface SessionsResponse {
  sessions: SessionWithISODate[]
  total: number
  page: number
  pageSize: number
}

export interface SessionDetailResponse {
  session: SessionWithISODate
  messages: Message[]
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
}

// Dashboard stats types
export interface ProjectStats {
  project: string
  projectName: string
  totalSessions: number
  lastUpdate: number
  recentSessions: number
}

export interface DailyMessageCount {
  date: string
  count: number
}

export interface DashboardStats {
  lastDayCount: number
  lastWeekCount: number
  totalSessions: number
  totalUserMessages: number
  totalAssistantMessages: number
  lastDayUserMessages: number
  lastDayAssistantMessages: number
  topProjects: ProjectStats[]
  dailyMessageCounts: DailyMessageCount[]
  lastUpdated?: number
}

// Machine types
export interface Machine {
  machineId: string
  machineName: string
  sessionCount: number
}

export interface MachinesResponse {
  machines: Machine[]
}

// Analytics types (v0.3)
export interface AnalyticsStats {
  dailyActivity: DailyActivityPoint[]
  weeklyActivity: WeeklyActivityPoint[]
  toolUsageStats: ToolUsageStat[]
  toolUsageTrend: ToolUsageTrendPoint[]
  sessionDurationStats: SessionDurationStats
  sessionsByHourOfDay: HourOfDayStat[]
  sessionsByDayOfWeek: DayOfWeekStat[]
  projectActivityHeatmap: ProjectHeatmapPoint[]
  sourceBreakdown: SourceBreakdown[]
  estimatedTokenUsage: TokenUsageEstimate
}

export interface DailyActivityPoint {
  date: string
  userMessages: number
  assistantMessages: number
  toolUses: number
  sessions: number
}

export interface WeeklyActivityPoint {
  weekStart: string
  totalMessages: number
  sessions: number
  activeDays: number
}

export interface ToolUsageStat {
  toolName: string
  count: number
  percentage: number
  trend: 'up' | 'down' | 'stable'
}

export interface ToolUsageTrendPoint {
  date: string
  [toolName: string]: number | string
}

export interface SessionDurationStats {
  averageMinutes: number
  medianMinutes: number
  longestSession: { sessionId: string; display: string; minutes: number } | null
  distribution: { range: string; count: number }[]
}

export interface HourOfDayStat {
  hour: number
  count: number
}

export interface DayOfWeekStat {
  day: number
  dayName: string
  count: number
}

export interface ProjectHeatmapPoint {
  project: string
  date: string
  messageCount: number
  sessionCount: number
}

export interface SourceBreakdown {
  sourceType: string
  sessionCount: number
  messageCount: number
  percentage: number
}

export interface TokenUsageEstimate {
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedTotalTokens: number
  bySource: { sourceType: string; inputTokens: number; outputTokens: number }[]
  disclaimer: string
}
