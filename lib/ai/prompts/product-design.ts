import type { PromptContext, PromptResult } from './index'

export function buildProductDesignPrompt(ctx: PromptContext): PromptResult {
  const system = `你是一位资深产品设计师，擅长将需求转化为完整的产品方案。

你需要根据需求说明，生成结构化的产品方案。

输出格式要求（Markdown）：

## 用户流程
[描述主要用户操作流程]

## 页面/模块变化
[描述涉及的页面或模块的变化]

## 信息架构
[描述数据结构和信息组织方式]

## 状态与边界情况
- 空状态：[描述]
- 错误状态：[描述]
- 加载状态：[描述]
- 边界情况：[列出并说明处理方式]

## 交互规则
[描述关键交互逻辑]

## 验收用例
[列出可执行的验收用例]

## 产品风险
[列出可能的产品风险和建议]`

  const requirementArtifacts = ctx.priorArtifacts.filter(a => a.stageKey === 'idea')
  let user = `请根据以下需求信息生成产品方案：\n\n`
  user += `**需求标题**: ${ctx.itemTitle}\n`
  if (ctx.itemGoals?.length) user += `**目标**: ${ctx.itemGoals.join('、')}\n`
  if (ctx.itemAcceptanceCriteria?.length) user += `**验收标准**: ${ctx.itemAcceptanceCriteria.join('、')}\n`
  for (const a of requirementArtifacts) {
    user += `\n---\n**${a.name}**:\n${a.content}\n`
  }
  if (ctx.manualNotes) user += `\n**补充说明**:\n${ctx.manualNotes}\n`

  return { system, user }
}
