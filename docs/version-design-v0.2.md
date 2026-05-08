# CodeMemory v0.2 — Multi-Tool Support (Codex CLI, Cursor, Trae)

## Context

v0.1 已实现 Claude Code 会话的完整 ELT 流程（Sync Agent → Server Parser → PostgreSQL）。v0.2 将扩展为多工具支持，使 CodeMemory 成为通用的 AI Coding 会话管理平台。

## 目标

引入插件式多数据源架构，支持 Codex CLI（JSONL）、Cursor（SQLite）、Trae（SQLite）。

## 数据源分析

| 工具 | 数据路径 | 格式 | 难度 |
|------|---------|------|------|
| Codex CLI | `~/.codex/history.jsonl` + `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | JSONL | 低（与 Claude Code 相似） |
| Cursor | `~/Library/Application Support/Cursor/User/globalStorage/` | state.vscdb (SQLite) | 高 |
| Trae | `~/Library/Application Support/Trae/User/globalStorage/` | 类似 Cursor | 高 |

## 分阶段交付

- **Phase 1A: Codex CLI** — 优先实现，JSONL 格式与 Claude Code 高度相似
- **Phase 1B: Cursor** — 导出脚本方式提取 state.vscdb
- **Phase 1C: Trae** — 复用 Cursor 基础设施

---

## 架构设计

### 1. Sync Agent — Source 插件接口

新建 `packages/sync-agent/src/sources/types.ts`：

```typescript
export interface DiscoveredFile {
  filePath: string
  sourceType: string       // 'claude-code' | 'codex-cli' | 'cursor' | 'trae'
  fileType: 'history-index' | 'session-data' | 'unknown'
  size: number
  modifiedAt: Date
}

export interface ConversationSource {
  readonly name: string
  readonly label: string
  readonly watchDirs: string[]
  discoverFiles(): DiscoveredFile[]
}
```

### 2. Source 实现

**ClaudeCodeSource** (`packages/sync-agent/src/sources/claude-code.ts`)
- 从现有 `scanner.ts` 提取逻辑
- `watchDirs`: `[join(homedir(), '.claude')]`
- 递归扫描 `.jsonl` 文件

**CodexCLISource** (`packages/sync-agent/src/sources/codex-cli.ts`)
- `watchDirs`: `[join(homedir(), '.codex')]`
- 扫描 `history.jsonl` + `sessions/` 子目录

**CursorSource** (`packages/sync-agent/src/sources/cursor.ts`)
- `watchDirs`: `[join(homedir(), 'Library/Application Support/Cursor/User/globalStorage')]`
- 策略：提供导出脚本，将 SQLite 数据转 JSONL，再由 sync agent 拾取
- 原因：避免 native 依赖，避免读取运行中的数据库

**TraeSource** (`packages/sync-agent/src/sources/trae.ts`)
- 复用 Cursor 逻辑，修改路径和可能的表/列名

### 3. Sync Agent 重构

**`packages/sync-agent/src/scanner.ts`**

```typescript
const sources: ConversationSource[] = [
  new ClaudeCodeSource(),
  // CodexCLISource 等按需注册
]

export function scanAllJsonlFiles(baseDir?: string): DiscoveredFile[] {
  if (baseDir) return new ClaudeCodeSource().discoverFiles()  // 向后兼容
  return sources.flatMap(s => s.discoverFiles())
}
```

**`packages/sync-agent/src/sync.ts`**

- `pushBatch` payload 增加 `sourceType` 字段
- `fullSync` 按注册的 source 分别扫描并标记

**`packages/sync-agent/src/config.ts`**

```typescript
export interface SyncConfig {
  // ... 现有字段
  sources?: string[]  // ['claude-code', 'codex-cli'] — 默认 ['claude-code']
}
```

`init` 命令提示选择启用的数据源。

### 4. Server — Parser 插件系统

**`lib/parsers/types.ts`**

```typescript
export interface RawFileParser {
  readonly name: string
  parseHistoryIndex(content: string): Map<string, ParsedSession>
  parseSessionData(content: string): Map<string, ParsedMessage[]>
}
```

**`lib/parsers/claude-code.ts`** — 从 `raw-file-parser.ts` 提取

**`lib/parsers/codex-cli.ts`** — Codex JSONL 格式解析

Codex JSONL 结构（基于实际文件分析）：
```jsonl
{"role":"user","content":[{"type":"text","text":"..."}],"timestamp":"..."}
{"role":"assistant","content":[{"type":"text","text":"..."},{"type":"tool_use","name":"Bash","input":{...}}],"timestamp":"..."}
```

解析器需要将 Codex 字段映射到统一的 `ParsedMessage` 格式。

**`lib/parsers/cursor.ts`** / **`lib/parsers/trae.ts`** — 处理导出脚本产生的 JSONL

**`lib/parsers/registry.ts`**

```typescript
const parsers: Map<string, RawFileParser> = new Map()

export function registerParser(parser: RawFileParser): void
export function getParser(sourceType: string): RawFileParser | undefined
export function getAllParserNames(): string[]
```

注册 `ClaudeCodeParser` → `'claude-code'`，`CodexCliParser` → `'codex-cli'`。

### 5. Server 解析调度重构

**`lib/raw-file-parser.ts`**

从包含所有解析逻辑的文件变为轻量调度器：
1. 按 sourceType 分组获取待处理 raw_files
2. 通过 `getParser(sourceType)` 查找解析器
3. 调用解析器的 `parseHistoryIndex` / `parseSessionData`
4. Upsert 逻辑不变

---

## Schema 变更

**Migration 0003: 添加 sourceType 列**

```sql
ALTER TABLE raw_files ADD COLUMN source_type VARCHAR(50) NOT NULL DEFAULT 'claude-code';
ALTER TABLE sessions ADD COLUMN source_type VARCHAR(50) NOT NULL DEFAULT 'claude-code';
CREATE INDEX idx_sessions_source_type ON sessions(source_type);
```

**`lib/db/schema.ts` 修改**：

```typescript
// rawFiles 表
sourceType: varchar('source_type', { length: 50 }).notNull().default('claude-code'),

// sessions 表
sourceType: varchar('source_type', { length: 50 }).notNull().default('claude-code'),
```

`messages` 表不需要 sourceType — 通过所属 session 继承。

---

## API 变更

**新增 `GET /api/sources`**

返回已配置的数据源及同步状态：

```typescript
// app/api/sources/route.ts
interface SourcesResponse {
  sources: {
    name: string
    label: string
    lastSyncAt: string | null
    sessionCount: number
    fileCount: number
  }[]
}
```

**修改 sync push API**

`app/api/sync/push/route.ts` 的 `SyncPayload` 增加 `sourceType` 字段。

**修改 sessions API**

`app/api/sessions/route.ts` 支持可选 `source` 查询参数过滤。

---

## Frontend 变更

**Settings 页面** — 添加 "Connected Sources" 区域显示：
- 已启用的数据源列表
- 每个数据源的最近同步时间和会话数量
- 数据源启用/禁用开关

**Sessions 列表** — 支持按数据源过滤

---

## 文件清单

### 新建文件
- `packages/sync-agent/src/sources/types.ts`
- `packages/sync-agent/src/sources/claude-code.ts`
- `packages/sync-agent/src/sources/codex-cli.ts`
- `packages/sync-agent/src/sources/cursor.ts`
- `packages/sync-agent/src/sources/trae.ts`
- `lib/parsers/types.ts`
- `lib/parsers/claude-code.ts`
- `lib/parsers/codex-cli.ts`
- `lib/parsers/cursor.ts`
- `lib/parsers/trae.ts`
- `lib/parsers/registry.ts`
- `app/api/sources/route.ts`

### 修改文件
- `packages/sync-agent/src/scanner.ts` — 委托到 Source 注册表
- `packages/sync-agent/src/sync.ts` — 增加 sourceType
- `packages/sync-agent/src/config.ts` — 多源配置
- `packages/sync-agent/src/index.ts` — init/start 命令支持多源
- `lib/raw-file-parser.ts` — 重构为调度器
- `lib/db/schema.ts` — 添加 sourceType 列
- `app/api/sync/push/route.ts` — 接受 sourceType
- `app/api/sessions/route.ts` — 支持 source 过滤

---

## 风险与开放问题

1. **Codex JSONL 格式稳定性**：未正式文档化，字段可能变化。采用防御性解析 + 详细日志。
2. **Cursor/Trae SQLite 访问**：应用运行时读取有风险。导出脚本方式更安全但不够自动化。
3. **Session ID 冲突**：不同工具可能产生相同格式的 ID。考虑命名空间前缀 `codex:uuid`。
4. **数据量**：Cursor 可能积累大量历史数据，初次同步需要较长时间。
5. **中英文字段映射**：不同工具的消息类型命名不同，需要统一映射表。

---

## 验证方式

1. `npm run build` — 确认无编译错误
2. `drizzle-kit push` — 验证 schema 迁移
3. `npm run dev` — 手动测试：
   - Claude Code 数据源仍正常工作
   - Codex CLI 数据文件能被正确扫描和解析
   - Sessions 列表支持按 source 过滤
   - `/api/sources` 返回正确的数据源状态
4. **不直接部署服务器**
