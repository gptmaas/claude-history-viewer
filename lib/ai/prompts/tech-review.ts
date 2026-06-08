import type { PromptContext, PromptResult } from './index'

export function buildTechReviewPrompt(ctx: PromptContext): PromptResult {
  const system = `你是一位严谨的技术评审专家。你需要对技术方案进行全面评审，并按 P0-P3 分级输出风险。

评审维度：
1. 是否复用现有架构和模式
2. 是否引入不必要的依赖
3. 数据迁移是否安全（如涉及）
4. 是否有测试闭环
5. 是否存在性能问题
6. 是否存在安全问题

风险分级定义：
- P0：必须人工确认，不允许自动流转
- P1：默认阻塞，用户可配置放行
- P2：可自动流转，但进入报告
- P3：信息提示

输出格式（Markdown）：

## 技术评审报告

### 1. 架构复用
**结论**: [通过/需关注/不通过]
**理由**: ...

（以此类推，共 6 个维度）

---

## 风险清单
| 等级 | 风险描述 | 建议 |
|------|---------|------|
| P0/P1/P2/P3 | ... | ... |

## 总结
- **总评**: [approved/needs_changes]
- **P0 风险数**: X
- **P1 风险数**: X`

  const ideaArtifacts = ctx.priorArtifacts.filter(a => a.stageKey === 'idea')
  const designArtifacts = ctx.priorArtifacts.filter(a => a.stageKey === 'product_design_review')
  const techArtifacts = ctx.priorArtifacts.filter(a => a.stageKey === 'technical_design_review')
  let user = `请评审以下技术方案：\n\n`
  user += `**需求标题**: ${ctx.itemTitle}\n`
  for (const a of ideaArtifacts) {
    user += `\n---\n**需求 - ${a.name}**:\n${a.content}\n`
  }
  for (const a of designArtifacts) {
    user += `\n---\n**${a.name}**:\n${a.content}\n`
  }
  for (const a of techArtifacts) {
    user += `\n---\n**${a.name}**:\n${a.content}\n`
  }

  return { system, user }
}
