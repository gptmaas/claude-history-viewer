# CodeMemory v0.4 — Search Enhancement

## Context

v0.3 提供了丰富的分析功能后，v0.4 聚焦于搜索体验的全面升级。当前搜索基于 PostgreSQL ILIKE 模糊匹配，存在性能差、无排名、无高亮、无分面等问题。

## 目标

- 用 PostgreSQL tsvector 全文搜索替换 ILIKE
- 增加分面过滤（项目、类型、工具、来源、日期范围）
- 改进结果排名和片段高亮
- 添加搜索自动补全

---

## Schema 变更

### Migration 0005: tsvector 全文搜索

```sql
-- 1. 新增 tsvector 列
ALTER TABLE messages ADD COLUMN search_tsvector TSVECTOR;

-- 2. 从现有内容填充（分批执行避免锁表）
-- 每批 10000 条
UPDATE messages SET search_tsvector =
  setweight(to_tsvector('simple', COALESCE(content::text, '')), 'A')
WHERE search_tsvector IS NULL
LIMIT 10000;

-- 3. 创建 GIN 索引
CREATE INDEX idx_messages_search_tsvector ON messages USING GIN(search_tsvector);

-- 4. 可选：pg_trgm 用于自动补全
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_messages_search_trgm ON messages USING GIN(content::text gin_trgm_ops);

-- 5. 迁移验证后移除旧列
-- ALTER TABLE messages DROP COLUMN search_vector;
```

> **注意**：使用 `'simple'` 配置而非 `'english'`，因为用户内容包含大量中文和代码，`'english'` 的词干提取会丢失中文信息。

### `lib/db/schema.ts` 修改

```typescript
import { customType } from 'drizzle-orm/pg-core'

const tsvector = customType<{ data: string }>({
  dataType() { return 'tsvector' }
})

// messages 表中替换 searchVector
searchTsvector: tsvector('search_tsvector'),
```

### 解析时更新 tsvector

修改 `lib/raw-file-parser.ts`，插入消息时计算 tsvector：

```sql
INSERT INTO messages (..., search_tsvector)
VALUES (..., to_tsvector('simple', $textContent))
```

从 JSONB content 提取纯文本用于索引。

---

## 搜索查询重构

### 替换 ILIKE 为 tsquery

**修改 `lib/db-data-source.ts` 的 `searchSessions`**：

```sql
SELECT m.*, s.session_id, s.display, s.project, s.project_name, s.source_type,
       ts_rank(m.search_tsvector, query) AS rank,
       ts_headline('simple', m.content::text, query,
         'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
       ) AS headline
FROM messages m
JOIN sessions s ON m.session_id = s.id,
     plainto_tsquery('simple', $keyword) query
WHERE m.user_id = $userId
  AND m.search_tsvector @@ query
  $filters
ORDER BY rank DESC
LIMIT 100
```

`ts_headline` 直接生成带 `<mark>` 标签的高亮片段，无需手动截取。

### 两阶段搜索保留

保留现有的 session 标题搜索（ILIKE 足够），消息内容搜索切换到 tsvector。

---

## 分面过滤

### 类型定义

**修改 `lib/types.ts`**：

```typescript
export interface SearchFilters {
  query: string
  project?: string
  machineId?: string
  sourceType?: string       // 来自 v0.2
  messageType?: string      // 'user' | 'assistant' | 'tool_use' | 'tool_result'
  toolName?: string         // 'Bash' | 'Edit' | 'Write' 等
  dateRange?: {
    start: string
    end: string
  }
}

export interface SearchFacets {
  projects: { name: string; count: number }[]
  messageTypes: { type: string; count: number }[]
  toolNames: { name: string; count: number }[]
  sources: { sourceType: string; count: number }[]
  dateRange: { earliest: string; latest: string }
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  query: string
  facets: SearchFacets
}
```

### 分面查询

在主搜索查询旁并行执行分面计数查询：

```sql
-- 项目分面
SELECT s.project, COUNT(*) AS count
FROM messages m JOIN sessions s ON m.session_id = s.id,
     plainto_tsquery('simple', $keyword) query
WHERE m.user_id = $userId AND m.search_tsvector @@ query
GROUP BY s.project ORDER BY count DESC

-- 消息类型分面
SELECT m.type, COUNT(*) AS count
FROM messages,
     plainto_tsquery('simple', $keyword) query
WHERE user_id = $userId AND search_tsvector @@ query
GROUP BY m.type

-- 工具名分面
SELECT content->0->>'name' AS tool_name, COUNT(*) AS count
FROM messages,
     plainto_tsquery('simple', $keyword) query
WHERE user_id = $userId AND search_tsvector @@ query
  AND type = 'assistant'
GROUP BY tool_name
```

---

## 自动补全

### API

**新建 `app/api/search/suggestions/route.ts`**：

```
GET /api/search/suggestions?q=prefix&limit=10
```

返回匹配的 session 标题和常用工具名。

### 查询策略

```sql
-- Session 标题匹配
SELECT display, project FROM sessions
WHERE user_id = $userId AND display ILIKE $prefix || '%'
LIMIT 5

-- 工具名匹配
SELECT DISTINCT content->0->>'name' AS name FROM messages
WHERE user_id = $userId AND content->0->>'name' ILIKE $prefix || '%'
LIMIT 5
```

---

## API 变更

### 修改 `GET /api/search`

新增查询参数：

| 参数 | 说明 |
|------|------|
| `type` | 消息类型过滤 |
| `tool` | 工具名过滤 |
| `source` | 来源类型过滤 |
| `from` | 日期范围起始 (ISO) |
| `to` | 日期范围结束 (ISO) |

响应新增 `facets` 字段。

### 新增 `GET /api/search/suggestions`

| 参数 | 说明 |
|------|------|
| `q` | 搜索前缀 |
| `limit` | 返回数量（默认 10） |

---

## Frontend 重构

### 修改 `app/search/page.tsx`

- **左侧过滤面板**：可折叠面板，包含分面复选框
  - 项目列表（带计数）
  - 消息类型（user/assistant/tool_use/tool_result）
  - 工具名列表（带计数）
  - 数据源（来自 v0.2）
  - 日期范围选择器
- **自动补全**：输入框下拉建议
- **高亮片段**：使用 `ts_headline` 返回的 `<mark>` 标签渲染
- **结果卡片**：显示匹配上下文 + 元数据标签（项目、来源、日期、工具）

### 新建组件

| 组件 | 文件 | 功能 |
|------|------|------|
| 过滤面板 | `components/search/filter-panel.tsx` | 左侧可折叠过滤器 |
| 分面复选框 | `components/search/facet-checkbox.tsx` | 带计数的复选框 |
| 日期范围 | `components/search/date-range-picker.tsx` | 日期区间选择 |
| 自动补全 | `components/search/autocomplete.tsx` | 输入建议下拉 |
| 高亮片段 | `components/search/highlighted-snippet.tsx` | 渲染 `<mark>` 高亮 |

---

## 文件清单

### 新建文件
- `app/api/search/suggestions/route.ts`
- `components/search/filter-panel.tsx`
- `components/search/facet-checkbox.tsx`
- `components/search/date-range-picker.tsx`
- `components/search/autocomplete.tsx`
- `components/search/highlighted-snippet.tsx`

### 修改文件
- `lib/types.ts` — SearchFilters, SearchFacets, SearchResponse 更新
- `lib/data-source.ts` — searchSessions 签名更新
- `lib/db-data-source.ts` — tsvector 查询 + 分面
- `lib/local-data-source.ts` — 本地模式搜索更新
- `lib/db/schema.ts` — tsvector 列
- `lib/raw-file-parser.ts` — 解析时填充 tsvector
- `app/search/page.tsx` — 全面重构
- `app/api/search/route.ts` — 新增过滤参数

---

## 依赖

- v0.2 的 `sourceType` 列（来源过滤）
- v0.3 的工具提取逻辑（工具名分面）

---

## 风险与开放问题

1. **tsvector 语言配置**：`'english'` 对中文效果极差，使用 `'simple'` 配置可保留中文分词（按字符），但对长句匹配不够精确。未来可考虑接入中文分词库（如 `pg_jieba`）。
2. **大规模数据回填**：tsvector 填充需要扫描所有消息，大数据量下必须分批执行。
3. **pg_trgm 可用性**：需要 PostgreSQL 超级用户权限安装扩展。某些托管服务可能不支持。提供 fallback 实现。
4. **分面查询性能**：每次搜索附带分面计数查询增加负载。可考虑缓存分面结果（5 分钟 TTL）。
5. **高亮标签安全**：`ts_headline` 返回的 `<mark>` 标签需要在 React 中安全渲染（使用 `dangerouslySetInnerHTML`），需确保 XSS 安全。

---

## 验证方式

1. `npm run build` — 确认无编译错误
2. `drizzle-kit push` — 验证 schema 迁移（tsvector 列 + 索引）
3. `npm run dev` — 手动测试：
   - 搜索功能正常，结果按相关性排序
   - 分面过滤器正确显示和过滤
   - 高亮片段正确渲染
   - 自动补全工作
   - 日期范围过滤正常
   - 中文搜索有效
4. **不直接部署服务器**
