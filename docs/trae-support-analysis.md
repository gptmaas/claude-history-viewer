# Trae 数据源支持分析

## Context

CodeMemory v0.2 设计文档已将 Trae 列为支持目标，标记为"复用 Cursor 基础设施"。本分析基于用户机器上的实际 Trae 数据，评估可行方案。

## Trae 简介

Trae 是字节跳动推出的 AI 编程 IDE，基于 VS Code 二次开发。提供 Chat 和 Builder 两种 Agent 模式，同时有 CLI 组件（`~/.trae/`）。

用户机器上存在两个版本：
- **Trae**：`~/Library/Application Support/Trae/`
- **Trae Solo**：`~/Library/Application Support/TRAE SOLO/`

## 数据存储全貌

### 目录结构

```
~/Library/Application Support/Trae/
├── User/
│   ├── globalStorage/
│   │   └── state.vscdb          ← 全局 KV 存储（会话配置、模型选择）
│   └── workspaceStorage/
│       └── <hash>/
│           └── state.vscdb      ← 工作区 KV 存储（输入历史、UI 状态）
├── ModularData/
│   ├── ai-chat/
│   │   └── database.db          ← 加密二进制 ⚠️
│   └── ai-agent/
│       ├── database.db          ← 加密二进制 ⚠️
│       └── sandbox/
│           └── <id>.json        ← 沙箱配置（明文 JSON）
├── Local Storage/
│   └── leveldb/                 ← 浏览器风格 LevelDB
└── Session Storage/
    └── *.ldb                    ← 会话级 LevelDB
```

### 各文件详解

#### 1. Workspace state.vscdb — 可读，但无消息体

每个打开过的项目有一个 workspace 目录，内含 `state.vscdb`（标准 VS Code SQLite KV 表，`ItemTable(key, value)`）。

**与 AI 会话相关的 Key：**

| Key | 大小 | 内容 |
|-----|------|------|
| `chat.ChatSessionStore.index` | ~26B | `{"version":1,"entries":{}}` — 始终为空 |
| `icube_session_agent_map` | ~72B | `{"<sessionId>":"chat\|builder"}` — 会话→Agent 映射 |
| `ChatStore` | ~500B-2KB | 会话 UI 状态（turn 高度、展开状态） |
| `memento/icube-ai-agent-storage` | ~350B | 会话列表，**messages 数组全为空** |
| `icube-ai-agent-storage-input-history` | 1.5MB | 纯文本用户输入历史（无结构化消息，无 AI 回复） |
| `history.entries` | ~16KB | VS Code 文件打开历史 |

**关键发现**：`memento/icube-ai-agent-storage` 中有 sessionId 列表和空的 messages 数组，说明消息体**不存储在 workspace state.vscdb 中**。

示例数据结构：
```json
{
  "list": [
    { "sessionId": "69148c9d1c3e0d57d4e75dc6", "messages": [] },
    { "sessionId": "691415084a8fa980927a4f46", "messages": [] }
  ],
  "currentSessionId": "690ec347fbedd9261b7fada3"
}
```

#### 2. Global state.vscdb — 会话关系配置

存储全局 Agent 模式和模型选择：

| Key | 内容 |
|-----|------|
| `ai-chat:sessionRelation:globalModeMap` | `{"solo_coder":1,"solo_builder":2}` |
| `ai-chat:sessionRelation:globalModelMap` | `{"solo_coder":"gpt-5.4","solo_builder":"gpt-5"}` |
| `ai-chat:sessionRelation:modeMap` | 每个会话的模式映射 |
| `all_session_badges_<sessionId>` | 会话徽章（大量，数十个） |

#### 3. ModularData 加密数据库 — ⚠️ 完整对话数据所在

`ai-chat/database.db` 和 `ai-agent/database.db`：

```
$ file database.db
database.db: data    ← 非 SQLite 格式

$ xxd database.db | head -2
00000000: 4edd 5e94 3763 9090 3b40 44f5 430c 36eb  ← 无 SQLite magic
00000010: fb20 58c4 bf4f a64b f4e5 d7e3 5ae0 97b0
```

- 无 `SQLite format 3` 头部签名
- 伴随文件 `-shm`（共享内存）和 `-wal`（预写日志）表明底层引擎可能是 SQLite，但文件已加密
- 73KB 的主文件 + 空 WAL，推测存储了结构化对话数据

#### 4. Sandbox JSON 文件 — 明文，无对话内容

`ModularData/ai-agent/sandbox/<id>.json` 为 JSON 格式的沙箱配置，包含 `gitStatus`、`fileList` 等上下文信息，不含对话消息。

### 会话 ID 格式

Trae 使用 22 字符的十六进制会话 ID（类似 MongoDB ObjectId）：
```
69c4cac96114cb9d77c0edd2  69148c9d1c3e0d57d4e75dc6  690ec347fbedd9261b7fada3
```

这与 Claude Code 的 UUID 格式和 Codex CLI 的滚动格式都不同。

---

## 与已有数据源对比

| 特性 | Claude Code | Codex CLI | Trae |
|------|------------|-----------|------|
| 存储格式 | JSONL 文件 | JSONL 文件 | 加密 SQLite + LevelDB |
| 文件路径 | `~/.claude/` | `~/.codex/` | `~/Library/Application Support/Trae/` |
| 消息格式 | `{type, role, content}` | `{role, content[]}` | 未知（加密） |
| 可读性 | ✅ 直接可读 | ✅ 直接可读 | ❌ 加密 |
| 会话索引 | `history.jsonl` | `history.jsonl` | `state.vscdb` 分散存储 |
| CLI 数据 | ✅ | ✅ | ❌（`~/.trae/` 仅扩展目录） |

---

## 可行方案

### 方案 A：导出脚本（推荐，与 v0.2 设计一致）

**思路**：利用 Trae 的内部 API 或日志输出，编写独立脚本将会话导出为 JSONL，再由现有 ELT 管线处理。

**可行性**：中等。需要逆向或利用 Trae 的扩展 API。

**优点**：
- 不需要解密数据库
- v0.2 已规划此路径
- 导出脚本可独立维护

**缺点**：
- 需要研究 Trae 内部 API
- 可能需要用户手动触发导出
- 并非实时自动同步

### 方案 B：解密 ModularData 数据库

**思路**：逆向 `database.db` 的加密方式，直接读取。

**可行性**：低。

**优点**：如成功，可获得完整对话数据。

**缺点**：
- 加密算法未知
- 可能违反服务条款
- 加密方式可能随版本变化

### 方案 C：仅导入元数据

**思路**：从可读的 `state.vscdb` 提取会话列表（sessionId、项目、Agent 类型、时间），但不包含消息内容。

**可行性**：高，可立即实现。

**优点**：快速展示会话列表，用户可看到项目使用概览。

**缺点**：无消息内容，无法搜索，价值有限。

### 方案 D：日志解析

**思路**：从 Trae 日志目录 (`logs/`) 提取对话内容。

**可行性**：低。

**优点**：不需要解密。

**缺点**：日志格式非结构化，不完整，版本变化频繁。

---

## 推荐路径

1. **短期**：方案 A — 研究 Trae 扩展 API / IPC 接口，编写导出脚本
2. **中期**：评估导出脚本的自动化程度，决定是否集成到 sync-agent
3. **长期**：如有 Trae 官方导出功能，可直接适配

### 导出脚本研究方向

- Trae 基于 VS Code，可能有类似的扩展 API
- Trae 的 `icube` 框架可能有内部 RPC 接口
- Trae 日志中可能包含结构化对话数据
- 社区可能有相关逆向工程成果

---

## 相关 Schema

无需变更。现有 `sourceType` 字段（`varchar(50)`）已支持 `'trae'`，Parser 注册表和 Source 注册表在 v0.2 已设计完毕，添加新 Source 只需实现接口并注册即可。详见 `docs/version-design-v0.2.md`。

---

*分析日期：2026-05-10*
