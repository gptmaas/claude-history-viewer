import type { PromptContext, PromptResult } from './index'

export function buildTaskBreakdownPrompt(ctx: PromptContext): PromptResult {
  const system = `你是一位资深技术负责人，擅长将技术方案拆分为可执行的开发任务。

输出格式要求（JSON 数组）：

\`\`\`json
[
  {
    "title": "任务标题",
    "description": "任务详细描述",
    "estimatedComplexity": "low|medium|high",
    "dependencies": ["依赖的任务标题，无依赖则为空数组"],
    "riskLevel": "P0|P1|P2|P3"
  }
]
\`\`\`

要求：
- 每个任务应该是一个独立的、可验证的开发单元
- 复杂度评估要考虑代码量和不确定性
- 依赖关系要明确标注
- 风险等级按 P0-P3 分级
- 只输出 JSON，不要输出其他内容`

  const techArtifacts = ctx.priorArtifacts.filter(a => a.stageKey === 'technical_design_review')
  let user = `请根据以下技术方案拆分开发任务：\n\n`
  user += `**需求标题**: ${ctx.itemTitle}\n`
  for (const a of techArtifacts) {
    user += `\n---\n**${a.name}**:\n${a.content}\n`
  }

  return { system, user }
}
