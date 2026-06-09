export type GenerateType =
  | 'requirement'
  | 'product_design'
  | 'product_review'
  | 'technical_design'
  | 'tech_review'
  | 'task_breakdown'
  | 'test_plan'

export interface PromptContext {
  itemTitle: string
  itemBackground: string | null
  itemGoals: string[] | null
  itemAcceptanceCriteria: string[] | null
  sourceSessionExcerpt?: string
  manualNotes?: string
  priorArtifacts: Array<{ stageKey: string; name: string; content: string }>
  repoContext?: string
}

export interface PromptResult {
  system: string
  user: string
}

export interface GenerateMeta {
  artifactName: string
  artifactType: 'markdown' | 'json'
  isReview: boolean
}

export const GENERATE_LABELS: Record<GenerateType, string> = {
  requirement: 'AI 补全需求',
  product_design: '生成产品方案',
  product_review: '生成产品评审',
  technical_design: '生成技术方案',
  tech_review: '生成技术评审',
  task_breakdown: '生成任务拆分',
  test_plan: '生成测试计划',
}

export const GENERATE_META: Record<GenerateType, GenerateMeta> = {
  requirement: { artifactName: '需求说明', artifactType: 'markdown', isReview: false },
  product_design: { artifactName: '产品方案', artifactType: 'markdown', isReview: false },
  product_review: { artifactName: '产品评审报告', artifactType: 'markdown', isReview: true },
  technical_design: { artifactName: '技术方案', artifactType: 'markdown', isReview: false },
  tech_review: { artifactName: '技术评审报告', artifactType: 'markdown', isReview: true },
  task_breakdown: { artifactName: '任务拆分', artifactType: 'json', isReview: false },
  test_plan: { artifactName: '测试计划', artifactType: 'markdown', isReview: false },
}

export { buildRequirementPrompt } from './requirement'
export { buildProductDesignPrompt } from './product-design'
export { buildProductReviewPrompt } from './product-review'
export { buildTechnicalDesignPrompt } from './technical-design'
export { buildTechReviewPrompt } from './tech-review'
export { buildTaskBreakdownPrompt } from './task-breakdown'
export { buildTestPlanPrompt } from './test-plan'

import { buildRequirementPrompt } from './requirement'
import { buildProductDesignPrompt } from './product-design'
import { buildProductReviewPrompt } from './product-review'
import { buildTechnicalDesignPrompt } from './technical-design'
import { buildTechReviewPrompt } from './tech-review'
import { buildTaskBreakdownPrompt } from './task-breakdown'
import { buildTestPlanPrompt } from './test-plan'

export function getPromptBuilder(type: GenerateType): (ctx: PromptContext) => PromptResult {
  switch (type) {
    case 'requirement': return buildRequirementPrompt
    case 'product_design': return buildProductDesignPrompt
    case 'product_review': return buildProductReviewPrompt
    case 'technical_design': return buildTechnicalDesignPrompt
    case 'tech_review': return buildTechReviewPrompt
    case 'task_breakdown': return buildTaskBreakdownPrompt
    case 'test_plan': return buildTestPlanPrompt
  }
}
