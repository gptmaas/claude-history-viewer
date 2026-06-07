# CodeMemory v0.7.0 — 桌面 App MVP

## Context

v0.7.0 是 v0.7 主版本的第一步，目标是把当前本地 Web Viewer 包成可双击启动的桌面 App。该版本不引入复杂流水线自动化，只解决“打开即用”和“本地配置可管理”的基础体验。

当前项目已有 Tauri CLI 依赖和脚本，但还没有完整 `src-tauri` 目录。MVP 可以先采用“内置本地 Next server + Tauri 窗口”路线，降低前端迁移成本。

## 目标

- 新增可运行的 Tauri 桌面壳。
- 双击 App 后默认进入 Dashboard。
- 首次启动自动检测 Claude Code / Codex CLI 默认目录。
- 提供基础设置页管理数据源目录。
- 不要求用户手动执行 `npm run dev`。

## 分阶段交付

- **Phase 7.0A: Tauri 桌面壳** — `src-tauri`、窗口、菜单、启动脚本、打包配置。
- **Phase 7.0B: 启动体验** — 首次启动检测、本地模式默认配置、Dashboard 默认入口。
- **Phase 7.0C: 基础设置** — 数据目录配置、来源开关、索引状态占位。

## Phase 7.0A: Tauri 桌面壳

### 交付内容

- 新增 `src-tauri/`。
- 配置应用名称、图标、bundle identifier。
- 配置主窗口尺寸、最小尺寸、标题。
- 配置 macOS/Windows/Linux 基础打包参数。
- 新增桌面启动脚本，例如 `pnpm desktop:dev`、`pnpm desktop:build`。

### 技术路线

MVP 推荐：

```text
Tauri App
  -> 启动本地 Next server
  -> 主窗口打开 http://127.0.0.1:<port>
```

该路线允许继续复用现有 Next.js 页面、API route 和组件。后续 v0.7.1/v0.7.2 稳定后，再评估是否把本地数据处理下沉到 Tauri Rust 后端或独立 local engine。

### 验收标准

- `pnpm desktop:dev` 可以打开桌面窗口。
- 桌面窗口能访问当前 Dashboard。
- 关闭窗口后本地服务随 App 生命周期退出。
- 打包命令能生成本机可运行的开发包或安装包。

## Phase 7.0B: 启动体验

### 首次启动流程

1. 检测 `~/.claude` 与 `~/.codex`。
2. 找到任一数据源时进入 Dashboard，并显示后台扫描状态。
3. 未找到数据源时进入设置页，引导用户选择目录。
4. 用户选择目录后保存到本地配置。
5. 后续启动直接读取本地配置。

### 本地配置

配置建议存储在用户应用数据目录：

```json
{
  "mode": "local-desktop",
  "sources": [
    { "type": "claude-code", "path": "~/.claude", "enabled": true },
    { "type": "codex-cli", "path": "~/.codex", "enabled": true }
  ],
  "lastOpenedAt": "2026-06-07T00:00:00.000Z"
}
```

### 验收标准

- 新用户首次启动时不需要配置账号。
- 有默认数据源时自动进入 Dashboard。
- 无默认数据源时能进入设置页并保存目录。
- 重启 App 后配置仍然生效。

## Phase 7.0C: 基础设置

### 设置项

- 数据源目录列表。
- 来源类型：Claude Code、Codex CLI。
- 启用/禁用数据源。
- 添加目录。
- 删除目录。
- 本地配置文件位置展示。
- 索引状态占位：等待 v0.7.1 接入真实索引。

### 需要保守处理的点

- 不自动扫描用户整个 home 目录。
- 用户授权目录之外不读取文件。
- 删除数据源只删除配置，不删除原始文件。
- 任何路径访问失败都应展示可理解错误。

## 非目标

- 不引入 SQLite 索引。
- 不实现完整文件监听。
- 不实现流水线页面。
- 不自动调用 AI Coding CLI。

