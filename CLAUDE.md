# CodeMemory (claude-history-viewer)

## 项目概述

Claude Code 会话历史查看器，支持本地模式和云端模式。包含 Next.js Web 应用和独立的同步工具（sync agent）。

## 架构

- **ELT 模式**：同步工具只搬运原始 JSONL 文件到服务端，解析逻辑在服务端 `lib/raw-file-parser.ts` 中完成
- **机器标识**：每台机器通过 `machineId`（hash）和 `machineName`（hostname）区分
- **数据源**：`DATA_SOURCE_MODE` 环境变量控制 `local`（读本地文件）或 `cloud`（读 PostgreSQL）

## 关键目录

- `packages/sync-agent/` — 同步工具 CLI（`codememory-sync`），负责扫描并上传原始 JSONL 文件
- `lib/raw-file-parser.ts` — 服务端解析原始 JSONL → sessions/messages
- `lib/db/schema.ts` — 数据库 Schema（Drizzle ORM + PostgreSQL）
- `app/api/sync/` — 同步 API（push/status）
- `lib/data-source.ts` — 数据源抽象层

## 部署

发布到服务器时执行：

```bash
./deploy-remote.sh
```

脚本会自动完成：rsync 同步代码 → drizzle-kit push 更新数据库 Schema → npm install & build → pm2 restart

服务器地址：`wzd01`，应用目录：`/home/ubuntu/apps/codememory`，PM2 进程名：`codememory`

## 同步工具

```bash
cd packages/sync-agent
npm run build                # 构建
node dist/index.js init      # 初始化配置
node dist/index.js sync      # 手动同步
node dist/index.js start     # 启动守护进程（初始同步 + 文件监听）
node dist/index.js status    # 查看同步状态
```

配置文件位于 `~/.claude-sync/config.json`，机器标识缓存在 `~/.claude-sync/machine-id` 和 `~/.claude-sync/machine-name`。

## Git 规范

- 提交时不加 `Co-Authored-By` 行
