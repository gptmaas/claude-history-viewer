# 当前已实现功能分析

本文档基于当前代码结构梳理项目已经实现的功能，并按两个产品形态拆分：

- 个人本地化版本
- 团队云端版本（同步服务 + 云端后台）

## 1. 个人本地化版本

个人本地化版本的核心是一个本地运行的 Next.js Web Viewer，直接读取本机 Claude Code 历史数据目录，不依赖数据库、登录系统或云端同步服务。

### 1.1 数据读取与解析

已实现：

- 默认读取 `~/.claude/history.jsonl`。
- 默认读取 `~/.claude/projects/**/*.jsonl` 中的会话明细。
- 支持通过 `CLAUDE_DIR` 环境变量指定 Claude Code 数据目录。
- 支持解析会话列表、会话详情、用户消息、Assistant 消息、工具调用和工具结果。
- 支持结构化 content，包括 text block、thinking block 等。

主要代码：

- `lib/claude-history.ts`
- `lib/local-data-source.ts`

### 1.2 本地 Dashboard

已实现：

- 近 24 小时统计。
- 近 7 天统计。
- 总会话数、用户消息数、Assistant 消息数。
- 每日消息趋势图。
- 项目活跃度排行。
- 最近更新时间展示。

主要页面/API：

- `app/page.tsx`
- `app/api/stats/route.ts`
- `app/api/projects/route.ts`

### 1.3 会话浏览

已实现：

- 会话列表分页浏览。
- 按项目筛选会话。
- 会话详情页查看完整对话。
- 消息按角色区分展示。
- 支持 Markdown 渲染、代码高亮、JSON 查看、工具调用查看。
- 支持用户消息、Assistant 消息、工具调用、工具结果等不同消息类型。

主要页面/API：

- `app/sessions/page.tsx`
- `app/sessions/[id]/page.tsx`
- `app/api/sessions/route.ts`
- `app/api/sessions/[id]/route.ts`

### 1.4 搜索

已实现：

- 本地模式下基于解析后的文件内容进行搜索。
- 搜索结果可定位到匹配会话和匹配消息。

主要页面/API：

- `app/search/page.tsx`
- `app/api/search/route.ts`
- `lib/claude-history.ts`

### 1.5 项目视图

已实现：

- 按项目聚合会话。
- 展示项目名称、会话数量、最近更新时间。
- 支持从项目进入相关会话。

主要页面/API：

- `app/projects/page.tsx`
- `app/api/projects/route.ts`

### 1.6 导出

已实现：

- 导出 Markdown。
- 导出 JSON。
- 导出 HTML。
- `pdf` 格式目前返回的是 print-mode HTML，由浏览器打印能力完成 PDF 输出。
- Markdown/HTML 导出包含会话元信息、消息内容和工具调用摘要。

主要代码：

- `lib/export/index.ts`
- `lib/export/markdown-exporter.ts`
- `lib/export/html-exporter.ts`
- `app/api/sessions/[id]/export/route.ts`

### 1.7 缓存与文件监听

已实现：

- 会话列表缓存。
- 会话详情缓存。
- 统计数据缓存。
- 本地文件监听，用于在 Claude Code 历史文件变化时失效相关缓存。
- 会话列表缓存支持持久化到本地缓存文件。

主要代码：

- `lib/session-cache.ts`
- `lib/stats-cache.ts`
- `lib/cache-manager.ts`
- `lib/file-watcher.ts`

### 1.8 本地版限制

当前限制：

- 本地模式主要支持 Claude Code 数据读取。
- Codex CLI 解析能力主要在云端 raw file 解析链路中使用，本地数据源尚未统一接入多 source。
- 本地模式下高级数据分析返回空/default 数据。
- 本地模式下用量分析返回空/default 数据。
- 本地模式不启用登录、API Key、机器维度、用户隔离和云同步。

## 2. 团队云端版本

团队云端版本已经具备云端产品的核心链路：本地同步 agent 上传数据，云端保存 raw files，服务端解析入库，Web 后台按用户隔离查询、搜索和分析。

需要注意的是，当前实现更准确地说是“多用户云端版本”。组织、团队空间、成员邀请、RBAC、团队项目共享等真正团队协作模型尚未看到完整实现。

## 2.1 云端认证与用户体系

已实现：

- 用户注册。
- 用户登录。
- NextAuth Credentials Provider。
- 邮箱 + 密码认证。
- JWT session。
- 注册时自动生成默认 API Key。
- 云端模式下中间件保护页面和 API。

主要代码：

- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/api/register/route.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `lib/auth.ts`
- `middleware.ts`

### 2.2 API Key 管理

已实现：

- API Key 生成。
- API Key hash 存储。
- API Key 前缀展示。
- API Key 列表查看。
- API Key 创建。
- API Key 删除。
- 同步 API 使用 `Authorization: Bearer <api_key>` 鉴权。
- API Key 使用时更新 `lastUsedAt`。

主要代码：

- `lib/auth-server.ts`
- `app/api/keys/route.ts`
- `app/settings/page.tsx`

### 2.3 数据库模型

已实现 PostgreSQL + Drizzle ORM schema：

- `users`：用户。
- `api_keys`：API Key。
- `raw_files`：本地同步上来的原始 JSONL 文件。
- `sessions`：解析后的会话。
- `messages`：解析后的消息。
- `sync_state`：同步状态。
- `shared_links`：分享链接。

已支持的重要字段：

- 用户隔离：`userId`。
- 机器维度：`machineId`、`machineName`。
- 来源类型：`sourceType`，目前内置 `claude-code` 和 `codex-cli`。
- 会话时长：`durationSeconds`、`firstMessageAt`、`lastMessageAt`。
- 模型与用量：`model`、`usage`。
- 搜索字段：`searchVector`、`searchTsvector`。

主要代码：

- `lib/db/schema.ts`
- `lib/db/index.ts`
- `lib/db/migrations/`

### 2.4 云端数据源

已实现：

- `DataSource` 抽象。
- 本地文件数据源 `LocalDataSource`。
- PostgreSQL 数据源 `DbDataSource`。
- 通过 `DATA_SOURCE_MODE=cloud` 切换云端模式。
- 所有云端查询按 `userId` 隔离。

云端数据源支持：

- 会话列表。
- 会话详情。
- 搜索。
- Dashboard 统计。
- 项目列表。
- 机器列表。
- 高级分析。
- 用量分析。

主要代码：

- `lib/data-source.ts`
- `lib/db-data-source.ts`

### 2.5 同步 API

已实现：

- `POST /api/sync/push` 接收本地同步 agent 上传的 raw files。
- `GET /api/sync/status` 查询同步状态。
- API Key 鉴权。
- raw file 按 `userId + machineId + filePath` upsert。
- 文件内容 hash 相同则跳过。
- 新文件或变更文件保存后触发服务端解析。
- 返回 accepted/skipped 文件数和 parseResult。

主要代码：

- `app/api/sync/push/route.ts`
- `app/api/sync/status/route.ts`
- `lib/raw-file-parser.ts`

### 2.6 服务端 raw file 解析

已实现：

- 从 `raw_files` 中读取未解析或解析版本过旧的文件。
- 按 `sourceType` 分组解析。
- 支持 parser registry。
- 内置 Claude Code parser。
- 内置 Codex CLI parser。
- 解析 session metadata。
- 解析 message 数据。
- session upsert。
- message 按 uuid 去重插入。
- 提取搜索文本并生成 PostgreSQL tsvector。
- 更新 `sync_state`。

主要代码：

- `lib/raw-file-parser.ts`
- `lib/parsers/registry.ts`
- `lib/parsers/claude-code.ts`
- `lib/parsers/codex-cli.ts`

### 2.7 本地同步 Agent

已实现独立包 `packages/sync-agent`，发布名为 `codememory-sync`。

CLI 命令：

- `codememory-sync init`：初始化服务器地址、API Key、source、目录、同步间隔。
- `codememory-sync sync`：手动同步一次。
- `codememory-sync start`：启动同步守护进程。
- `codememory-sync status`：查看同步状态。

同步能力：

- 支持 Claude Code，默认目录 `~/.claude`。
- 支持 Codex CLI，默认目录 `~/.codex`。
- 支持多 source 同步。
- 支持每个 source 自定义目录。
- 支持机器 ID 和机器名。
- 本地使用 `~/.claude-sync/config.json` 保存配置。
- 本地使用 `~/.claude-sync/file-cache.json` 保存文件 hash 缓存。
- 使用 chokidar 监听 JSONL 文件变化。
- 文件变化后 debounce，再触发同步。
- 上传时按约 5MB batch 分批。

主要代码：

- `packages/sync-agent/src/index.ts`
- `packages/sync-agent/src/config.ts`
- `packages/sync-agent/src/sync.ts`
- `packages/sync-agent/src/scanner.ts`
- `packages/sync-agent/src/watcher.ts`
- `packages/sync-agent/src/sources/`

重要实现细节：

- 当前同步不是严格的“按 JSONL 行 cursor 增量同步”。
- 当前同步策略是“按文件内容 hash 检测变化，变化后上传整个文件，服务端解析时去重”。
- 服务端 `sync_state.syncCursor` 当前更像同步时间标记，不是严格文件行游标。

### 2.8 云端搜索

已实现：

- PostgreSQL `tsvector` 全文搜索。
- `plainto_tsquery('simple', query)` 查询。
- `ts_rank` 相关度排序。
- `ts_headline` 高亮摘要。
- 会话标题 ILIKE 补充搜索。
- 搜索 facets。

支持过滤：

- 项目。
- 机器。
- 来源类型。
- 消息类型。
- 工具名。
- 日期范围。

主要代码：

- `app/api/search/route.ts`
- `app/api/search/suggestions/route.ts`
- `lib/db-data-source.ts`

### 2.9 云端 Dashboard 与数据分析

已实现 Dashboard：

- 近 24 小时会话/消息。
- 近 7 天会话。
- 总会话。
- 用户消息/Assistant 消息。
- Top projects。
- 近 30 天每日消息数。

已实现高级分析：

- 日活动趋势。
- 周活动趋势。
- 工具使用统计。
- 工具使用趋势。
- 会话时长统计。
- 小时活跃分布。
- 星期活跃分布。
- 项目活动热力图。
- 来源分布。
- Token 粗估。

已实现用量分析：

- 按模型统计请求数。
- 按模型统计 input/output token。
- 每日模型请求趋势。
- 每日模型 token 趋势。
- 模型汇总表。

主要页面/API：

- `app/analytics/page.tsx`
- `app/usage-analysis/page.tsx`
- `app/api/analytics/route.ts`
- `app/api/usage-analysis/route.ts`
- `components/analytics/`
- `components/usage-analysis/`

### 2.10 机器与来源管理

已实现：

- 机器列表 API。
- 按机器筛选会话和项目。
- 来源列表 API。
- 来源包含可用 parser、最后同步时间、会话数、raw file 数。
- 当前来源标签包含 Claude Code 和 Codex CLI。

主要 API：

- `app/api/machines/route.ts`
- `app/api/sources/route.ts`

### 2.11 分享功能

已实现：

- 创建会话分享链接。
- 分享链接 slug。
- 可设置过期时间。
- 可设置访问密码。
- 分享链接访问计数。
- 分享链接撤销。
- 公开分享页。
- 分享内容基础脱敏。

脱敏能力包括：

- API key/token/secret/password 等环境变量样式内容。
- 常见 key/token 字符串模式。
- 文件路径字段截断为文件名。

主要代码：

- `app/api/share/route.ts`
- `app/api/share/[slug]/route.ts`
- `app/api/share/manage/route.ts`
- `app/share/[slug]/page.tsx`
- `lib/share-utils.ts`

### 2.12 部署与运维

已存在：

- Dockerfile。
- docker-compose。
- PM2 ecosystem 配置。
- 部署脚本。
- 监控脚本。
- 部署说明文档。

主要文件：

- `Dockerfile`
- `docker-compose.yml`
- `ecosystem.config.cjs`
- `deploy.sh`
- `deploy-remote.sh`
- `monitor.sh`
- `DEPLOYMENT.md`
- `README-DEPLOY.md`

## 3. 当前实现中的风险与待补齐点

### 3.1 团队能力尚未完整

当前云端版本已经支持多用户数据隔离，但尚未看到以下团队能力：

- 组织/团队空间。
- 成员邀请。
- 角色权限。
- 项目级共享权限。
- 团队级聚合看板。
- 团队成员间会话可见性控制。

因此当前阶段更适合描述为“多用户云端版本”，而不是完整团队协作版本。

### 3.2 同步机制不是严格增量

当前同步 agent 使用文件 hash 判断变更，变更后上传整个 JSONL 文件。服务端通过 uuid 去重消息。

这套方案简单可靠，但在历史文件很大时会有重复上传成本。若要支持大规模团队场景，可以继续演进为：

- 按文件记录已同步 offset/line number。
- 只上传新增 JSONL 行。
- 服务端维护 per-file cursor。
- 支持失败后断点续传。

### 3.3 API Key 删除存在越权风险

`app/api/keys/route.ts` 的 DELETE 当前只按 `keyId` 删除，没有把 `session.user.id` 放入删除条件。

风险：

- 如果攻击者拿到别人的 key id，可能删除不属于自己的 API Key。

建议：

- 删除条件改为 `id = keyId AND userId = currentUserId`。

### 3.4 分享撤销存在越权风险

`app/api/share/manage/route.ts` 的 DELETE 当前先按 slug update，再检查 owner。

风险：

- 非 owner 请求某个 slug 时，可能已经把该分享链接置为 inactive。

建议：

- update 条件改为 `slug = slug AND ownerId = currentUserId`。
- 或先查询并校验 owner，再执行 update。

### 3.5 本地模式与云端模式能力不一致

当前高级分析、用量分析、多机器、多 source 等能力主要依赖数据库模式。

本地模式如果也要成为完整个人版，需要补齐：

- 本地 Codex CLI source。
- 本地多 source 统一解析。
- 本地高级分析。
- 本地模型用量分析。

## 4. 总结

当前项目已经形成两个产品形态：

- 个人本地化版本：适合个人在本机查看、搜索、复盘 Claude Code 历史记录。
- 云端版本：已经具备多用户登录、API Key、本地 agent 同步、云端解析入库、搜索、分析、分享和部署能力。

下一阶段如果目标是“团队云端版本”，重点不在基础同步和后台，而在团队模型与权限体系：

- team/org 数据模型。
- 成员与角色。
- 项目/会话可见性策略。
- 团队级 dashboard。
- 团队数据隔离和审计。
