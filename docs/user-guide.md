# CodeMemory 使用指南

> **CodeMemory（代码记忆库）** — AI Coding 会话同步与分析平台
>
> 让每一次 AI Coding 会话，成为可搜索、可复用、可沉淀的开发记忆。

***

## 这是什么？

CodeMemory 是一个面向 AI Coding 工具的会话管理平台，由两部分组成：

- **云端 Web 平台** — 在浏览器中查看、搜索、分析你的所有 AI 编程对话
- **本地同步工具** — 一条命令，把你电脑上的 AI 会话记录自动同步到云端

目前支持 **Claude Code**，后续将支持 Cursor、Windsurf 等工具。

***

## 快速开始（3 步）

```
1. 注册账号，拿到 API Key
2. 安装同步工具，一条命令完成配置
3. 自动同步，打开网页查看
```

***

## 第一步：注册账号

1. 打开 **<https://codememory.gptmaas.com>**
2. 点击底部 **「Register」** 链接
3. 填写邮箱和密码，点击 **Register**

注册成功后，页面会显示你的 **API Key**（以 `chk_live_` 开头的一串字符）。

> **重要：** API Key 只显示这一次，请立即复制保存。如果丢失，可以在 Settings 页面重新创建。

***

## 第二步：安装并配置同步工具

### 安装

同步工具是一个 Node.js CLI，需要先安装 Node.js（v18+）。

```bash
npm install -g codememory-sync
```

安装完成后，`codememory-sync` 命令就可以直接使用了：

```bash
codememory-sync --help
```

### 配置

运行初始化命令，按提示输入参数：

```bash
codememory-sync init
```

你会看到如下交互：

```
CodeMemory Sync Configuration

Server URL: https://codememory.gptmaas.com
API Key: chk_live_你的密钥
Claude directory [/Users/你的用户名/.claude]:
Sync interval in seconds [60]:

Configuration saved!
```

| 参数                   | 说明                      | 示例                               |
| -------------------- | ----------------------- | -------------------------------- |
| **Server URL**       | 云端服务器地址                 | `https://codememory.gptmaas.com` |
| **API Key**          | 第一步注册时获得的密钥             | `chk_live_cb67832b...`           |
| **Claude directory** | Claude Code 本地数据目录，默认即可 | `/Users/ethan/.claude`           |
| **Sync interval**    | 自动同步间隔（秒），默认 60         | `60`                             |

配置文件保存在 `~/.claude-sync/config.json`。

***

## 第三步：同步数据

### 方式一：手动同步（推荐先用这个试试）

```bash
codememory-sync sync
```

输出示例：

```
✔ Synced 528 sessions, 13674 messages
```

### 方式二：启动守护进程（自动实时同步）

```bash
codememory-sync start
```

守护进程会：

1. 先执行一次全量同步
2. 然后持续监听 `~/.claude/` 目录的变化
3. 检测到新对话时自动上传

输出示例：

```
CodeMemory Sync Daemon

Server: https://codememory.gptmaas.com
Claude dir: /Users/ethan/.claude
✔ Initial sync complete: 528 sessions, 13674 messages
Watching /Users/ethan/.claude for changes...
```

按 `Ctrl+C` 停止守护进程。

### 查看同步状态

```bash
codememory-sync status
```

输出示例：

```
Sync Status

  Last sync: 2026/5/2 14:30:00
  Sessions:  528
  Messages:  13674
```

### 命令速查

```bash
codememory-sync init      # 初始化配置
codememory-sync sync      # 手动同步一次
codememory-sync start     # 启动守护进程（自动同步）
codememory-sync status    # 查看同步状态
codememory-sync --help    # 查看帮助
```

***

## 第四步：在 Web 端查看数据

登录 \*\*<https://codememory.gptmaas.com**，你会看到：>

### Dashboard（首页）

- 总会话数、用户/助手消息数
- 按项目分组的统计
- 最近 30 天的消息趋势图

### Sessions（会话列表）

- 按时间倒序展示所有对话
- 可按项目筛选
- 点击任意会话查看完整对话内容

### Session Detail（会话详情）

- 完整的对话记录，支持 Markdown 渲染
- 代码块语法高亮
- 工具调用（tool\_use）展示
- 支持导出为 Markdown / JSON / HTML

### Search（搜索）

- 全文搜索所有对话内容
- 搜索关键词高亮显示
- 显示匹配片段上下文

### Settings（设置）

- 管理 API Key（创建 / 删除）
- 查看同步配置说明

***

## 用 PM2 让同步工具后台常驻

如果你希望同步工具在后台持续运行（开机自启），推荐使用 PM2：

```bash
# 全局安装 PM2（如果没有）
npm install -g pm2

# 启动同步守护进程
pm2 start "codememory-sync start" --name codememory-sync

# 查看状态
pm2 status

# 查看日志
pm2 logs codememory-sync

# 设置开机自启
pm2 save
pm2 startup
```

***

## 多台机器同步

CodeMemory 支持多台电脑同步到同一个账号：

1. 在每台机器上安装同步工具
2. 使用同一个 API Key（或在 Settings 创建新的）
3. 分别运行 `init` 和 `start`

所有机器的对话数据会汇总到你的账号下。

***

## 数据安全说明

- 所有数据通过 HTTPS 加密传输
- API Key 使用 SHA-256 哈希存储，服务端不保存明文
- 每个用户只能访问自己的数据
- 密码使用 bcrypt 加密存储

***

## 常见问题

### Q: 同步工具提示 `HTTP 401: Invalid API Key`

API Key 不正确或已过期。登录 Web 端 → Settings → 创建新的 API Key。

### Q: 同步的数据量很大，速度慢？

同步工具会自动按 50 个会话一批分批上传，无需手动干预。首次全量同步可能需要几分钟，后续增量同步很快。

### Q: 我换了电脑，历史数据还在吗？

在。数据存在云端数据库中，用同一账号登录即可查看所有历史数据。

### Q: 支持其他 AI 编程工具吗？

目前仅支持 Claude Code。Cursor、Windsurf 等工具的支持正在开发中。

***

## 反馈与建议

如有问题或建议，请提交 Issue 或联系开发团队。
