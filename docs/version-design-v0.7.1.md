# CodeMemory v0.7.1 — 本地索引与多数据源

## Context

v0.7.0 解决桌面 App 启动体验后，v0.7.1 聚焦本地数据层。当前本地模式适合轻量查看，但复杂 Dashboard、搜索、流水线证据和后续自动化都需要稳定的本地索引。

本版本引入 SQLite，把 Claude Code 与 Codex CLI 数据源统一成 scanner/parser/indexer 流程。

## 目标

- 用 SQLite 保存本地会话、消息、项目、数据源和索引状态。
- 支持 Claude Code 与 Codex CLI 两类本地来源。
- 支持增量扫描、重建索引和索引状态展示。
- Dashboard、会话列表、搜索优先读取本地索引。

## 分阶段交付

- **Phase 7.1A: SQLite schema** — 本地 DB 初始化、表结构、迁移策略。
- **Phase 7.1B: Scanner/Parser 统一层** — 数据源扫描、hash、增量解析。
- **Phase 7.1C: UI 接入** — Dashboard、会话、搜索、索引状态页读取本地索引。

## Phase 7.1A: SQLite schema

### 建议表

- `local_sources`：数据源配置。
- `local_raw_files`：原始文件路径、mtime、size、hash、parse 状态。
- `local_sessions`：会话元数据。
- `local_messages`：消息内容、角色、时间、工具调用摘要。
- `local_projects`：项目路径与展示名。
- `local_index_runs`：扫描任务记录。

### 关键字段

`local_sources`：

```text
id
type: claude-code | codex-cli
path
enabled
last_scan_at
created_at
updated_at
```

`local_raw_files`：

```text
id
source_id
path
mtime
size
hash
parse_version
status: pending | parsed | failed | skipped
error_message
```

### 验收标准

- App 首次启动能创建本地 SQLite DB。
- schema 版本可追踪，后续能迁移。
- 删除 App 配置不会删除原始 Claude/Codex 数据。

## Phase 7.1B: Scanner/Parser 统一层

### 处理流程

```text
source config
  -> scan files
  -> compare mtime/size/hash
  -> parse changed files
  -> upsert sessions/messages
  -> write index run result
```

### 增量策略

- 优先用 `mtime + size` 判断是否可能变化。
- 变化文件再计算 hash。
- `parse_version` 变化时触发重解析。
- 解析失败写入状态，不阻塞其他文件。

### 多 source 兼容

- Claude Code：复用现有 JSONL parser。
- Codex CLI：复用或补齐 Codex parser。
- UI 层通过统一字段展示，不暴露原始格式差异。

### 验收标准

- 新增会话文件后，后台扫描能写入 SQLite。
- 修改已有文件后能增量更新。
- 解析失败可在索引状态页看到。
- 同一消息不会重复入库。

## Phase 7.1C: UI 接入

### Dashboard

读取本地索引展示：

- 今日会话数。
- 今日消息数。
- 最近 7 天趋势。
- 活跃项目。
- 最近会话。

### 会话与搜索

- 会话列表从 SQLite 分页读取。
- 会话详情从 SQLite 读取。
- 搜索先实现本地关键词匹配，可后续升级 FTS5。
- 支持 source/project/date 基础过滤。

### 索引状态页

- 当前数据源。
- 上次扫描时间。
- 文件总数、成功数、失败数。
- 手动触发扫描。
- 手动重建索引。

## 非目标

- 不实现流水线数据模型。
- 不实现 AI 自动生成。
- 不实现测试 runner。
- 不处理云端同步。

