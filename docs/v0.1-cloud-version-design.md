# Claude History Viewer - Cloud Version Design v0.1

## Context

当前 `claude-history-viewer` 是一个纯本地工具，通过读取 `~/.claude/` 目录下的 JSONL 文件来可视化和搜索 Claude Code 对话历史。用户希望将其扩展为云端版本：
- 在云端服务器部署 Web 应用，提供可视化查看、搜索、分析功能
- 本地运行同步 Agent，自动将 AI Coding 会话数据同步到云端
- 云端需要登录认证，每个用户只能看到自己的数据
- 参考 SwanLab 的设计模式：本地 SDK + 云端 Dashboard
- 需要可扩展支持其他 AI Coding 工具（Cursor、Windsurf 等）

## Architecture Overview

```
[Local Machine]                    [Cloud Server]
┌─────────────────┐                ┌──────────────────────┐
│  AI Coding Tool  │                │  Next.js Web App     │
│  (Claude Code)   │                │  ├─ Login/Auth       │
│       ↓          │                │  ├─ Dashboard        │
│  ~/.claude/*.jsonl│                │  ├─ Sessions View    │
│       ↓          │                │  └─ Search (FTS)     │
│  Sync Agent      │──HTTPS API──→ │                      │
│  (Node.js CLI)   │  (API Key)    │  PostgreSQL DB       │
│  - file watcher  │                │  - sessions          │
│  - batch sync    │                │  - messages          │
│  - system service│                │  - users/api_keys    │
└─────────────────┘                └──────────────────────┘
```

## Phase 1: DataSource Abstraction + Database Layer

**Goal**: 将数据访问层抽象为接口，支持本地文件系统和 PostgreSQL 两种实现。

### 1.1 DataSource Interface

**New file: `lib/data-source.ts`**

```typescript
export interface DataSource {
  loadSessionsList(userId: string, page: number, pageSize: number): Promise<SessionsResponse>
  loadSessionDetail(userId: string, sessionId: string): Promise<SessionDetail | null>
  searchSessions(userId: string, keyword: string): Promise<SearchResponse>
  getDashboardStats(userId: string): Promise<DashboardStats>
  getProjects(userId: string): Promise<ProjectStats[]>
}
```

### 1.2 Refactor Existing Code

- `lib/claude-history.ts` 保持不变，用 `lib/local-data-source.ts` 包装实现 `DataSource`（无需 userId 参数，本地模式忽略）
- 现有 API routes (`app/api/*`) 通过 `getDataSource()` 工厂函数获取数据源，本地模式返回 `LocalDataSource`，云端模式返回 `DbDataSource`

### 1.3 Database Schema (Drizzle ORM + PostgreSQL)

**New file: `lib/db/schema.ts`**

```
users: id, email, name, password_hash, created_at, updated_at
api_keys: id, user_id, key_hash, name, last_used_at, created_at
sessions: id, user_id, session_id, display, project, project_name,
          message_count, started_at, last_message_at, created_at, updated_at
messages: id, session_id, user_id, type, role, content (JSONB),
          uuid, timestamp, metadata (JSONB), search_vector (tsvector)
sync_state: id, user_id, source_type, source_path, last_synced_at, sync_cursor
```

**Key design**:
- `messages.content` 用 JSONB 存储原始内容，支持复杂查询
- `messages.search_vector` 用 PostgreSQL tsvector 支持全文搜索
- `sync_state` 记录每个用户的同步状态，支持增量同步

### 1.4 Database Configuration

**New files**: `lib/db/index.ts` (连接池), `lib/db/migrations/` (Drizzle migrations)

- 使用 `drizzle-orm/pg` 连接 PostgreSQL
- 环境变量 `DATABASE_URL` 配置数据库连接
- 本地开发可用 SQLite（drizzle 支持），生产用 PostgreSQL

## Phase 2: Authentication System

**Goal**: 实现用户注册/登录和 API Key 认证。

### 2.1 NextAuth Setup

**New files**: `app/api/auth/[...nextauth]/route.ts`, `lib/auth.ts`

- 使用 `next-auth`（已在 package.json 中）
- Credentials Provider（邮箱+密码注册登录）
- 可选：GitHub OAuth Provider
- JWT session strategy（无状态，适合 VPS 部署）

### 2.2 Auth Pages

**New files**: `app/login/page.tsx`, `app/register/page.tsx`

- 简洁的登录/注册页面，使用 shadcn/ui 组件
- 注册后自动生成一个 API Key（用于本地 Sync Agent 连接）

### 2.3 API Key Management

**New files**: `app/api/keys/route.ts`, `app/settings/page.tsx`

- 用户可创建/吊销 API Key
- API Key 格式：`chk_live_xxxxxxxxxxxxx`
- Key 只在创建时完整显示一次

### 2.4 Middleware

**New file**: `middleware.ts`

- Web 页面路由：检查 session cookie，未登录重定向到 `/login`
- `/api/sync/*` 路由：检查 API Key header (`Authorization: Bearer chk_live_xxx`)
- `/api/*` 其他路由：检查 session cookie

## Phase 3: Sync API (Server-side)

**Goal**: 实现云端数据接收接口。

### 3.1 Sync Push Endpoint

**New file: `app/api/sync/push/route.ts`**

```
POST /api/sync/push
Headers: Authorization: Bearer <api_key>
Body: {
  sessions: Session[]      // 会话列表（增量）
  messages: Message[]       // 消息列表（按会话分组）
  syncCursor: string        // 上次同步位置
}
Response: { success: true, syncedCount: number, nextCursor: string }
```

**Key logic**:
- 根据 API Key 鉴权获取 user_id
- 对 sessions 做 UPSERT（按 session_id 去重）
- 对 messages 做批量 INSERT（按 uuid 去重）
- 更新 messages 的 tsvector 全文搜索索引
- 更新 sync_state 记录同步进度
- 使用 PostgreSQL transaction 保证一致性

### 3.2 Sync Status Endpoint

**New file: `app/api/sync/status/route.ts`**

```
GET /api/sync/status
Headers: Authorization: Bearer <api_key>
Response: { lastSyncAt, totalSessions, totalMessages, syncCursor }
```

### 3.3 DbDataSource Implementation

**New file: `lib/db-data-source.ts`**

- 实现 `DataSource` 接口
- 所有查询添加 `WHERE user_id = ?` 条件
- Dashboard stats 使用 SQL 聚合查询
- Search 使用 PostgreSQL `tsvector` + `ts_rank`

## Phase 4: Local Sync Agent

**Goal**: 开发本地同步工具，自动采集并上传 AI 会话数据。

### 4.1 Sync Agent 项目结构

**New directory: `packages/sync-agent/`**（monorepo 结构或独立仓库）

```
packages/sync-agent/
├── src/
│   ├── index.ts          # CLI 入口
│   ├── watcher.ts        # 文件监听（复用 file-watcher.ts 的模式）
│   ├── parser.ts         # 解析 JSONL（复用 claude-history.ts 的解析逻辑）
│   ├── sync.ts           # 同步逻辑（批量上传、增量同步）
│   └── config.ts         # 配置管理（API URL、API Key）
├── package.json
└── tsconfig.json
```

### 4.2 CLI 命令

```bash
# 初始化配置（交互式输入服务器 URL 和 API Key）
npx claude-sync init

# 启动同步守护进程
npx claude-sync start

# 查看同步状态
npx claude-sync status

# 手动触发一次全量同步
npx claude-sync sync --full
```

### 4.3 同步策略

- **增量同步**：记录每个 JSONL 文件已同步的行数（sync cursor），只上传新增行
- **文件监听**：使用 `fs.watch()` 监听 `~/.claude/` 目录变化（复用 `lib/file-watcher.ts` 的 debounce 模式）
- **批量上传**：收集变化后批量发送，减少 API 请求次数
- **断点续传**：网络中断后从上次 cursor 继续
- **系统服务**：支持通过 PM2 或 systemd 常驻运行

### 4.4 Extensibility Design

`parser.ts` 设计为可插拔结构：

```typescript
interface ConversationParser {
  name: string           // 'claude-code' | 'cursor' | 'windsurf'
  watchDirs: string[]    // 需要监听的目录
  parse(raw: string): { sessions, messages }
}
```

未来添加 Cursor 等工具支持只需实现新的 `ConversationParser`。

## Phase 5: Cloud Web App Adaptation + Polish

**Goal**: 适配前端页面支持多用户，完善部署。

### 5.1 Frontend Adaptations

- 所有 API 调用自动带上用户 session（Next.js fetch 自动处理）
- Dashboard/Stats 按当前用户过滤
- 添加用户信息显示（右上角头像/邮箱）
- 添加 Settings 页面（API Key 管理）

### 5.2 Search Enhancement

- 替换当前的暴力搜索为 PostgreSQL 全文搜索
- 支持中英文分词
- 搜索结果高亮保留

### 5.3 Deployment

- **Server**: Linux VPS (推荐 2C4G)
- **Runtime**: Node.js 20+ with PM2
- **Database**: PostgreSQL 16
- **Reverse Proxy**: Caddy (自动 HTTPS)
- **Environment**: `.env.production` 配置 DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL

## Key Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `lib/data-source.ts` | NEW | DataSource 接口定义 |
| `lib/local-data-source.ts` | NEW | 本地文件系统实现 |
| `lib/db-data-source.ts` | NEW | PostgreSQL 数据源实现 |
| `lib/db/schema.ts` | NEW | Drizzle ORM schema |
| `lib/db/index.ts` | NEW | 数据库连接 |
| `lib/auth.ts` | NEW | NextAuth 配置 |
| `lib/auth-server.ts` | NEW | API Key 验证逻辑 |
| `middleware.ts` | NEW | 路由鉴权中间件 |
| `app/api/auth/[...nextauth]/route.ts` | NEW | Auth API |
| `app/api/sync/push/route.ts` | NEW | 数据同步接口 |
| `app/api/sync/status/route.ts` | NEW | 同步状态查询 |
| `app/api/keys/route.ts` | NEW | API Key 管理 |
| `app/login/page.tsx` | NEW | 登录页 |
| `app/register/page.tsx` | NEW | 注册页 |
| `app/settings/page.tsx` | NEW | 设置页（API Key） |
| `app/api/stats/route.ts` | MODIFY | 使用 DataSource |
| `app/api/sessions/route.ts` | MODIFY | 使用 DataSource |
| `app/api/sessions/[id]/route.ts` | MODIFY | 使用 DataSource |
| `app/api/search/route.ts` | MODIFY | 使用 DataSource |
| `app/api/projects/route.ts` | MODIFY | 使用 DataSource |
| `lib/claude-history.ts` | KEEP | 保留原始文件解析逻辑 |
| `lib/types.ts` | KEEP | 共享类型定义 |
| `packages/sync-agent/*` | NEW | 本地同步工具 |

## Existing Code to Reuse

| Source | What to Reuse |
|--------|--------------|
| `lib/claude-history.ts` | JSONL 解析逻辑（`parseProjectName`, `contentToString`, `extractContent`） |
| `lib/file-watcher.ts` | `fs.watch()` + debounce 模式，直接用于 Sync Agent |
| `lib/types.ts` | 所有 TypeScript 接口，云端版本保持一致 |
| `components/*` | 所有前端组件，无需修改 |

## Verification Plan

1. **Phase 1 验证**: 本地模式运行 `npm run dev`，确认所有页面功能与之前一致
2. **Phase 2 验证**: 注册/登录流程正常，未登录访问被拦截
3. **Phase 3 验证**: 使用 curl 模拟 Sync Agent 上传数据，确认数据正确入库
4. **Phase 4 验证**: 运行 `npx claude-sync start`，确认本地数据自动同步到云端
5. **Phase 5 验证**: 端到端测试——本地新建 Claude Code 会话 → Sync Agent 自动上传 → 云端 Dashboard 可见

## Implementation Priority

建议按 Phase 顺序实施，每个 Phase 完成后验证再进入下一个。Phase 1-3 是核心，Phase 4 是独立模块可并行开发，Phase 5 是收尾优化。
