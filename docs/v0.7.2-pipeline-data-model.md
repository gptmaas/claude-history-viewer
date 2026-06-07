# CodeMemory v0.7.2 — 流水线基础模型

## Context

v0.7.1 提供本地索引后，CodeMemory 已经有稳定的本地事实库。v0.7.2 在此基础上新增“流水线”一级入口，但只做数据模型、页面和手动流转，不引入自动编码和发布。

本版本的核心是让每个需求从想法到发布具备可追踪结构：阶段、产物、评审、门禁和事件日志。

## 目标

- 用户可以创建流水线项目和需求条目。
- 每个需求自动生成固定阶段轨道。
- 阶段可手动推进、阻塞、回退和跳过。
- 每个阶段可保存产物、评审结果和证据链接。
- Dashboard 能展示待处理项和阻塞项。

## 分阶段交付

- **Phase 7.2A: 数据模型与状态机** — pipeline tables、阶段状态、事件日志。
- **Phase 7.2B: 页面结构** — 流水线 Dashboard、新建需求、详情页、门禁中心。
- **Phase 7.2C: 会话证据关联** — 从会话链接到需求或阶段。

## Phase 7.2A: 数据模型与状态机

### 建议表

- `pipeline_projects`
- `pipeline_items`
- `pipeline_stages`
- `pipeline_artifacts`
- `pipeline_reviews`
- `pipeline_events`
- `pipeline_session_links`

### 阶段模板

```text
1. 需求想法
2. 方案设计与评审
3. 技术方案与评审
4. 开发编码与单元自测
5. 集成测试
6. 需求验收
7. 发布
```

### 阶段状态

- `not_started`
- `running`
- `waiting_review`
- `blocked`
- `passed`
- `failed`
- `skipped`

### 状态动作

- `start`
- `submit_artifact`
- `request_review`
- `approve`
- `reject`
- `block`
- `retry`
- `rollback`
- `advance`
- `skip`

每次状态变化必须写入 `pipeline_events`。

## Phase 7.2B: 页面结构

### 新增入口

侧边栏新增一级入口：`流水线`。

### 页面

- `流水线 Dashboard`：项目、需求、待确认、阻塞、最近事件。
- `新建需求`：标题、背景、目标、验收标准、来源会话。
- `流水线详情`：纵向阶段轨道、当前状态、产物、评审、日志。
- `阶段产物`：Markdown 文档或结构化字段。
- `门禁中心`：集中处理等待用户确认的阶段。
- `执行日志`：先展示手动事件，后续 v0.7.4 接入命令日志。

### 验收标准

- 能创建一个需求，并自动生成 7 个阶段。
- 能手动推进阶段状态。
- 能为阶段添加产物和评审结论。
- 能在详情页看到完整事件时间线。
- Dashboard 能显示待处理和阻塞需求。

## Phase 7.2C: 会话证据关联

### 关联能力

- 从会话详情页创建需求。
- 从会话详情页关联到已有流水线阶段。
- 在阶段页展示关联会话。
- 支持为关联添加备注和 link type。

### link type

- `requirement_source`
- `product_discussion`
- `technical_discussion`
- `implementation_log`
- `test_evidence`
- `acceptance_evidence`

## 非目标

- 不自动生成需求或方案。
- 不调用 AI Coding CLI。
- 不运行测试命令。
- 不做发布自动化。

