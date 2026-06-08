import type { PromptContext, PromptResult } from './index'

export function buildTechnicalDesignPrompt(ctx: PromptContext): PromptResult {
  const system = `你是一位资深技术架构师。你需要根据需求和产品方案，结合代码库现状，生成技术方案。

输出格式（Markdown）：

## 影响文件和模块
[列出需要修改或新增的文件/模块]

## 数据模型变更
[描述数据库 schema 变更，如有]

## API 设计
[描述新增或修改的 API 端点]

## 前端组件设计
[描述需要的组件变化]

## 后端逻辑设计
[描述需要的后端逻辑变化]

## 测试策略
[描述如何验证实现]

## 迁移策略
[描述数据迁移方案，如有]

## 回滚策略
[描述如何安全回滚]

## 风险清单
[列出技术风险，按 P0-P3 分级]`

  const ideaArtifacts = ctx.priorArtifacts.filter(a => a.stageKey === 'idea')
  const designArtifacts = ctx.priorArtifacts.filter(a => a.stageKey === 'product_design_review')
  let user = `请根据以下需求设计技术方案：\n\n`
  user += `**需求标题**: ${ctx.itemTitle}\n`
  for (const a of ideaArtifacts) {
    user += `\n---\n**需求 - ${a.name}**:\n${a.content}\n`
  }
  for (const a of designArtifacts) {
    user += `\n---\n**${a.name}**:\n${a.content}\n`
  }
  if (ctx.repoContext) {
    user += `\n---\n**代码库现状**:\n${ctx.repoContext}\n`
  }

  return { system, user }
}
