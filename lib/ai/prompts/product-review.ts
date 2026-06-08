import type { PromptContext, PromptResult } from './index'

export function buildProductReviewPrompt(ctx: PromptContext): PromptResult {
  const system = `你是一位严谨的产品评审专家。你需要从以下 6 个维度评审产品方案，每个维度给出"通过"、"需关注"或"不通过"的结论，并附上理由。

评审维度：
1. 是否解决原始需求
2. 是否有明确用户路径
3. 是否覆盖空状态、错误状态、加载状态
4. 是否可验收
5. 是否符合当前产品形态
6. 是否存在不必要复杂度

输出格式（Markdown）：

## 产品评审报告

### 1. 是否解决原始需求
**结论**: [通过/需关注/不通过]
**理由**: ...

### 2. 是否有明确用户路径
**结论**: [通过/需关注/不通过]
**理由**: ...

（以此类推，共 6 个维度）

---

## 总结
- 通过项: X/6
- 需关注项: X/6
- 不通过项: X/6
- **总评**: [approved/needs_changes]
- **主要风险**: [如有]`

  const requirementArtifacts = ctx.priorArtifacts.filter(a => a.stageKey === 'idea')
  const designArtifacts = ctx.priorArtifacts.filter(a => a.stageKey === 'product_design_review')
  let user = `请评审以下产品方案：\n\n`
  user += `**需求标题**: ${ctx.itemTitle}\n`
  for (const a of requirementArtifacts) {
    user += `\n---\n**需求 - ${a.name}**:\n${a.content}\n`
  }
  for (const a of designArtifacts) {
    user += `\n---\n**${a.name}**:\n${a.content}\n`
  }

  return { system, user }
}
