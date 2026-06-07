# CodeMemory v0.7.4 — 自动编码与测试执行

## Context

v0.7.3 产出了可评审的技术方案和任务拆分。v0.7.4 引入高风险自动化：调用本地 AI Coding CLI 完成开发任务、运行测试、分析失败并尝试修复。

本版本必须以命令白名单、执行日志、diff 审查和人工确认作为基础，不允许默认执行破坏性命令或发布动作。

## 目标

- 抽象 Executor，支持 Codex CLI、Claude Code 和 shell test runner。
- 从流水线任务生成实现 prompt。
- 自动读取 git diff 并形成变更摘要。
- 自动运行 lint/typecheck/unit test。
- 测试失败时自动生成修复任务并重试。
- 所有命令、输出、错误、重试都写入流水线日志。

## 分阶段交付

- **Phase 7.4A: Executor 与命令白名单** — 执行器抽象、权限配置、日志模型。
- **Phase 7.4B: 开发任务执行** — AI CLI 调用、diff 采集、变更摘要、风险检查。
- **Phase 7.4C: 测试与自动修复循环** — test runner、失败摘要、重试上限、门禁。

## Phase 7.4A: Executor 与命令白名单

### Executor 抽象

```text
Executor
- name: codex | claude-code | shell
- capabilities: edit_files, run_tests, inspect_git_diff
- run(task, context) -> result
```

### 命令白名单

用户必须显式配置允许执行的命令，例如：

- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `npm run test`

默认不允许：

- `rm`
- `git reset`
- `git push`
- `npm publish`
- 任意远端上传命令
- 未经确认的 shell 拼接命令

### 日志模型

每次执行记录：

- executor name。
- command 或 AI task。
- start/end time。
- exit code。
- stdout/stderr 摘要。
- 产物链接。
- 风险标记。

## Phase 7.4B: 开发任务执行

### 执行流程

1. 读取技术方案和任务拆分。
2. 用户选择一个任务或一组任务。
3. 生成实现 prompt。
4. 调用 Codex/Claude Code。
5. 读取 git diff。
6. 生成变更摘要。
7. 运行初步 diff 风险审查。
8. 写入阶段产物和事件日志。

### diff 风险审查

阻塞条件：

- 大规模无关改动。
- 删除大量文件。
- 修改认证、权限、支付、数据删除逻辑。
- 修改 lockfile 但无依赖说明。
- 测试被删除或跳过。

## Phase 7.4C: 测试与自动修复循环

### 循环流程

```text
run implementation
  -> inspect diff
  -> run tests
  -> summarize failure
  -> generate fix task
  -> retry until pass or max retries
```

### 默认策略

- 最大自动修复次数：3。
- lint/typecheck 默认阻塞。
- 单元测试默认阻塞。
- 长时间失败后进入 `failed` 或 `waiting_review`。
- 用户可手动继续、回退或结束任务。

### 验收标准

- 能配置并持久化命令白名单。
- 能从流水线任务启动 AI 编码执行。
- 能记录命令日志和 AI 执行结果。
- 能运行测试并展示结果。
- 失败时能自动重试，达到上限后停止。
- 所有高风险 diff 都进入人工确认。

## 非目标

- 不运行集成/E2E 测试。
- 不生成最终验收报告。
- 不自动 commit/tag/push。
- 不上传 release 包。

