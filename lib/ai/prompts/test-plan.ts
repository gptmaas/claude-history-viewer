import type { PromptContext, PromptResult } from './index'

export function buildTestPlanPrompt(ctx: PromptContext): PromptResult {
  const system = `你是一位资深测试工程师。你需要根据技术方案和任务拆分，生成测试计划。

输出格式（Markdown）：

## 测试范围
[描述本次需要测试的范围]

## 测试命令
[列出具体的测试命令]

## 单元测试计划
[列出需要新增或修改的单元测试]

## 集成测试计划
[列出需要运行的集成测试]

## 预期结果
[描述每个测试的预期结果]

## 测试风险
[列出可能影响测试的风险]`

  const techArtifacts = ctx.priorArtifacts.filter(a => a.stageKey === 'technical_design_review')
  let user = `请根据以下技术方案生成测试计划：\n\n`
  user += `**需求标题**: ${ctx.itemTitle}\n`
  for (const a of techArtifacts) {
    user += `\n---\n**${a.name}**:\n${a.content}\n`
  }

  return { system, user }
}
