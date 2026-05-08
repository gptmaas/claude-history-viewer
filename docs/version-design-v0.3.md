# CodeMemory v0.3 — Analytics & Insights

## Context

v0.2 完成多工具支持后，CodeMemory 已能采集多种 AI Coding 工具的会话数据。v0.3 将从单纯的会话查看器升级为分析平台，帮助用户理解自己的 AI 编码模式。

## 目标

提供可操作的洞察：活动趋势、工具使用统计、会话时长分析、Token 使用估算。

---

## 新增类型定义

**`lib/types.ts` 新增**：

```typescript
export interface AnalyticsStats {
  // 时间序列
  dailyActivity: DailyActivityPoint[]
  weeklyActivity: WeeklyActivityPoint[]

  // 工具使用
  toolUsageStats: ToolUsageStat[]
  toolUsageTrend: ToolUsageTrendPoint[]

  // 会话分析
  sessionDurationStats: SessionDurationStats
  sessionsByHourOfDay: HourOfDayStat[]
  sessionsByDayOfWeek: DayOfWeekStat[]

  // 项目分析
  projectActivityHeatmap: ProjectHeatmapPoint[]

  // 来源分布（来自 v0.2）
  sourceBreakdown: SourceBreakdown[]

  // Token 估算
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
  [toolName: string]: number | string  // 动态工具列
}

export interface SessionDurationStats {
  averageMinutes: number
  medianMinutes: number
  longestSession: { sessionId: string; display: string; minutes: number }
  distribution: { range: string; count: number }[]
}

export interface HourOfDayStat {
  hour: number
  count: number
}

export interface DayOfWeekStat {
  day: number       // 0=Sunday
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
```

---

## 数据查询实现

**修改 `lib/data-source.ts`** — 接口新增：

```typescript
getAnalyticsStats(userId: string, dateRange?: { start: Date; end: Date }): Promise<AnalyticsStats>
```

**修改 `lib/db-data-source.ts`** — 实现 `getAnalyticsStats`：

### 核心查询

**日活趋势**：
```sql
SELECT date_trunc('day', timestamp) AS day,
       type,
       COUNT(*) AS count
FROM messages
WHERE user_id = $userId AND timestamp >= $start
GROUP BY day, type
ORDER BY day
```

**工具使用统计**：
```sql
SELECT content->0->>'name' AS tool_name, COUNT(*) AS count
FROM messages
WHERE user_id = $userId
  AND type = 'assistant'
  AND content @> '[{"type":"tool_use"}]'
GROUP BY tool_name
ORDER BY count DESC
LIMIT 20
```

**会话时长**：
```sql
SELECT s.id, s.display, s.source_type,
       EXTRACT(EPOCH FROM (MAX(m.timestamp) - MIN(m.timestamp))) / 60 AS duration_minutes
FROM sessions s
JOIN messages m ON m.session_id = s.id
WHERE s.user_id = $userId
GROUP BY s.id
ORDER BY duration_minutes DESC
```

**每小时分布**：
```sql
SELECT EXTRACT(HOUR FROM timestamp) AS hour, COUNT(*) AS count
FROM messages
WHERE user_id = $userId
GROUP BY hour
ORDER BY hour
```

**项目活动热力图**：
```sql
SELECT s.project, date_trunc('day', m.timestamp) AS day,
       COUNT(*) AS messages, COUNT(DISTINCT s.id) AS sessions
FROM sessions s
JOIN messages m ON m.session_id = s.id
WHERE s.user_id = $userId AND m.timestamp >= $start
GROUP BY s.project, day
ORDER BY day
```

**Token 估算**：基于字符数启发式（英文 ~4 字符/token，代码 ~2 字符/token）。UI 必须显示免责声明。

### 性能优化

考虑物化视图缓存昂贵查询：

```sql
CREATE MATERIALIZED VIEW mv_daily_stats AS
SELECT user_id, date_trunc('day', timestamp) AS day, type, COUNT(*) AS count
FROM messages
GROUP BY user_id, date_trunc('day', timestamp), type;
```

同步事件时刷新物化视图。

---

## Schema 变更

**Migration 0004: 会话时长字段**

```sql
ALTER TABLE sessions ADD COLUMN duration_seconds INTEGER;
ALTER TABLE sessions ADD COLUMN first_message_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX idx_sessions_duration ON sessions(duration_seconds);
```

**`lib/db/schema.ts` 新增**：

```typescript
durationSeconds: integer('duration_seconds'),
firstMessageAt: timestamp('first_message_at', { withTimezone: true }),
```

在 `lib/raw-file-parser.ts` 解析阶段计算并存储：
- `durationSeconds` = 末消息时间 - 首消息时间
- `firstMessageAt` = 首条消息的时间戳

---

## API

**新增 `GET /api/analytics`**

```
GET /api/analytics?range=7d|30d|90d|all
```

返回完整 `AnalyticsStats` 对象。

---

## Frontend

### Analytics 页面

**新建 `app/analytics/page.tsx`**

全页分析视图，支持日期范围切换（7d / 30d / 90d / all）。

### 图表组件

| 组件 | 文件 | 图表类型 | 数据 |
|------|------|---------|------|
| 活动时间线 | `components/analytics/activity-timeline.tsx` | Recharts AreaChart | dailyActivity |
| 工具使用 | `components/analytics/tool-usage-chart.tsx` | Recharts PieChart | toolUsageStats |
| 会话时长 | `components/analytics/session-duration-chart.tsx` | Recharts BarChart | sessionDurationStats.distribution |
| 每小时热力图 | `components/analytics/hourly-heatmap.tsx` | Custom Grid | sessionsByHourOfDay |
| 项目热力图 | `components/analytics/project-heatmap.tsx` | Calendar Grid | projectActivityHeatmap |
| 来源分布 | `components/analytics/source-breakdown-chart.tsx` | Recharts StackedBar | sourceBreakdown |
| Token 估算 | `components/analytics/token-estimation-card.tsx` | Stat Cards | estimatedTokenUsage |

### 侧边栏

修改 `components/sidebar.tsx`，添加 Analytics 导航项（使用 `BarChart3` 图标），指向 `/analytics`。

### Dashboard 增强

修改 `app/page.tsx`，添加"查看详细分析"快捷入口。

---

## 文件清单

### 新建文件
- `app/analytics/page.tsx`
- `app/api/analytics/route.ts`
- `components/analytics/activity-timeline.tsx`
- `components/analytics/tool-usage-chart.tsx`
- `components/analytics/session-duration-chart.tsx`
- `components/analytics/hourly-heatmap.tsx`
- `components/analytics/project-heatmap.tsx`
- `components/analytics/source-breakdown-chart.tsx`
- `components/analytics/token-estimation-card.tsx`

### 修改文件
- `lib/types.ts` — 新增 Analytics 相关类型
- `lib/data-source.ts` — 接口新增 `getAnalyticsStats`
- `lib/db-data-source.ts` — 实现 analytics 查询
- `lib/local-data-source.ts` — 本地模式 analytics（可选）
- `lib/db/schema.ts` — duration_seconds, first_message_at
- `lib/raw-file-parser.ts` — 解析时计算时长
- `components/sidebar.tsx` — 添加 Analytics 导航项
- `app/page.tsx` — 添加分析入口

---

## 依赖

- v0.2 的 `sourceType` 列（来源分布图表）
- 现有 Recharts 依赖（已在 package.json 中）

---

## 风险与开放问题

1. **查询性能**：大数据量 messages 表上的聚合查询可能较慢。通过物化视图 + 日期范围过滤缓解。
2. **Token 估算准确性**：纯启发式，仅基于字符计数。UI 必须显示"仅为估算"免责声明。未来如果工具在 JSONL 中暴露 token 数则切换到实际数据。
3. **会话时长 ≠ 活跃时间**：用户可能离开后回来，时长计算会偏高。可考虑基于消息频率的活跃时间估算。
4. **Local 模式内存**：LocalDataSource 全量加载到内存，大数据集分析可能较慢。

---

## 验证方式

1. `npm run build` — 确认无编译错误
2. `drizzle-kit push` — 验证 schema 迁移
3. `npm run dev` — 手动测试：
   - `/analytics` 页面正确渲染所有图表
   - 日期范围切换正常
   - 工具使用统计准确
   - 会话时长计算合理
   - Token 估算显示免责声明
4. **不直接部署服务器**
