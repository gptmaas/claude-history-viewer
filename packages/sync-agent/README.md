# codememory-sync

> CodeMemory（代码记忆库）本地同步工具 — 将 AI Coding 会话记录自动同步到云端

[![npm version](https://img.shields.io/npm/v/codememory-sync.svg)](https://www.npmjs.com/package/codememory-sync)

## 这是什么？

`codememory-sync` 是 [CodeMemory](https://codememory.gptmaas.com) 的命令行同步工具，用于将你本地的 Claude Code 对话记录自动上传到云端，让你可以在网页端查看、搜索和分析所有 AI 编程对话。

## 安装

```bash
npm install -g codememory-sync
```

要求 Node.js >= 18。

## 快速开始

### 1. 注册账号

前往 [codememory.gptmaas.com/register](https://codememory.gptmaas.com/register) 注册账号，获取 API Key。

### 2. 初始化配置

```bash
codememory-sync init
```

按提示输入服务器地址和 API Key。

### 3. 同步数据

```bash
# 手动同步一次
codememory-sync sync

# 或启动守护进程，自动监听并同步
codememory-sync start
```

## 命令

```
codememory-sync init      初始化配置（服务器地址、API Key）
codememory-sync sync      手动同步一次
codememory-sync start     启动守护进程，自动实时同步
codememory-sync status    查看同步状态
codememory-sync --help    查看帮助
```

## 配置

配置文件保存在 `~/.claude-sync/config.json`。

| 参数 | 说明 | 默认值 |
|------|------|--------|
| serverUrl | 云端服务器地址 | - |
| apiKey | API 密钥（注册时获取） | - |
| claudeDir | Claude Code 本地数据目录 | `~/.claude` |
| syncInterval | 自动同步间隔（秒） | `60` |

## 后台常驻

使用 PM2 让同步工具在后台持续运行：

```bash
npm install -g pm2
pm2 start "codememory-sync start" --name codememory-sync
pm2 save
pm2 startup
```

## License

MIT
