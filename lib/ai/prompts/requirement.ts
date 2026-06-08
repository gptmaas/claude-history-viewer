import type { PromptContext, PromptResult } from './index'

export function buildRequirementPrompt(ctx: PromptContext): PromptResult {
  const system = `你是一位资深产品经理，擅长从模糊的想法中提炼出清晰的需求。

你需要根据用户提供的信息，生成结构化的需求说明。

输出格式要求（Markdown）：

## 背景
[需求的背景描述]

## 用户目标
[用户想要达成什么]

## 使用场景
[列出主要使用场景]

## 范围边界
[包含什么，不包含什么]

## 非目标
[明确不在本次范围内的事项]

## 验收标准
[列出可验证的验收标准，每条以 "- [ ] " 开头]

## 风险和未知问题
[列出可能的风险和需要进一步澄清的问题]

## 澄清问题
[列出你识别出的歧义点，需要用户回答的问题]`

  let user = `请根据以下信息生成需求说明：\n\n`
  user += `**标题**: ${ctx.itemTitle}\n`
  if (ctx.itemBackground) user += `**背景**: ${ctx.itemBackground}\n`
  if (ctx.itemGoals?.length) user += `**目标**: ${ctx.itemGoals.join('、')}\n`
  if (ctx.itemAcceptanceCriteria?.length) user += `**已有验收标准**: ${ctx.itemAcceptanceCriteria.join('、')}\n`
  if (ctx.sourceSessionExcerpt) user += `\n**相关会话摘录**:\n${ctx.sourceSessionExcerpt}\n`
  if (ctx.manualNotes) user += `\n**补充说明**:\n${ctx.manualNotes}\n`

  return { system, user }
}
