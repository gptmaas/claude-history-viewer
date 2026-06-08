// Pipeline domain types — moved from @codememory/core into the main app
// for v0.7.2 since the core workspace is not wired as a dependency.

export const PIPELINE_STAGE_IDS = [
  'idea',
  'product_design_review',
  'technical_design_review',
  'implementation_unit_test',
  'integration_test',
  'acceptance',
  'release',
] as const

export type PipelineStageId = (typeof PIPELINE_STAGE_IDS)[number]

export type PipelineStageStatus =
  | 'not_started'
  | 'running'
  | 'waiting_review'
  | 'blocked'
  | 'passed'
  | 'failed'
  | 'skipped'

export type PipelineTransition =
  | 'start'
  | 'submit_artifact'
  | 'request_review'
  | 'approve'
  | 'reject'
  | 'auto_pass'
  | 'block'
  | 'retry'
  | 'rollback'
  | 'advance'
  | 'skip'

export type PipelineRiskLevel = 'P0' | 'P1' | 'P2' | 'P3'

export interface PipelineStageDefinition {
  id: PipelineStageId
  title: string
  requiredArtifacts: string[]
  defaultRequiresHumanApproval: boolean
  autoAdvanceAllowed: boolean
}

export const PIPELINE_STAGES: PipelineStageDefinition[] = [
  {
    id: 'idea',
    title: '需求想法',
    requiredArtifacts: ['需求说明', '验收标准'],
    defaultRequiresHumanApproval: false,
    autoAdvanceAllowed: true,
  },
  {
    id: 'product_design_review',
    title: '方案设计与评审',
    requiredArtifacts: ['产品方案', '产品评审报告'],
    defaultRequiresHumanApproval: true,
    autoAdvanceAllowed: false,
  },
  {
    id: 'technical_design_review',
    title: '技术方案与评审',
    requiredArtifacts: ['技术方案', '任务拆分', '测试计划', '技术评审报告'],
    defaultRequiresHumanApproval: true,
    autoAdvanceAllowed: false,
  },
  {
    id: 'implementation_unit_test',
    title: '开发编码与单元自测',
    requiredArtifacts: ['代码变更摘要', '单元测试结果', '自动评审报告'],
    defaultRequiresHumanApproval: false,
    autoAdvanceAllowed: true,
  },
  {
    id: 'integration_test',
    title: '集成测试',
    requiredArtifacts: ['集成测试结果', '失败分析或通过证明'],
    defaultRequiresHumanApproval: false,
    autoAdvanceAllowed: true,
  },
  {
    id: 'acceptance',
    title: '需求验收',
    requiredArtifacts: ['验收报告', '验收证据'],
    defaultRequiresHumanApproval: true,
    autoAdvanceAllowed: false,
  },
  {
    id: 'release',
    title: '发布',
    requiredArtifacts: ['发布清单', '构建结果', '发布说明'],
    defaultRequiresHumanApproval: true,
    autoAdvanceAllowed: false,
  },
]

export interface PipelineGateResult {
  passed: boolean
  risks: PipelineRisk[]
  missingArtifacts: string[]
}

export interface PipelineRisk {
  level: PipelineRiskLevel
  message: string
  requiresHumanApproval: boolean
}

export interface PipelineAutomationPolicy {
  allowAutoProductReview: boolean
  allowAutoTechnicalReview: boolean
  allowAutoImplementation: boolean
  allowAutoTestFixes: boolean
  allowAutoAcceptance: boolean
  allowAutoRelease: boolean
  maxImplementationRetries: number
}

export const DEFAULT_PIPELINE_POLICY: PipelineAutomationPolicy = {
  allowAutoProductReview: false,
  allowAutoTechnicalReview: false,
  allowAutoImplementation: true,
  allowAutoTestFixes: true,
  allowAutoAcceptance: false,
  allowAutoRelease: false,
  maxImplementationRetries: 3,
}

export type PipelineSessionLinkType =
  | 'requirement_source'
  | 'product_discussion'
  | 'technical_discussion'
  | 'implementation_log'
  | 'test_evidence'
  | 'acceptance_evidence'

export function getPipelineStage(id: PipelineStageId): PipelineStageDefinition {
  const stage = PIPELINE_STAGES.find((item) => item.id === id)
  if (!stage) {
    throw new Error(`Unknown pipeline stage: ${id}`)
  }
  return stage
}

export function canAutoAdvanceStage(
  stage: PipelineStageDefinition,
  gate: PipelineGateResult,
  policy: PipelineAutomationPolicy = DEFAULT_PIPELINE_POLICY,
): boolean {
  if (!stage.autoAdvanceAllowed || !gate.passed || gate.missingArtifacts.length > 0) {
    return false
  }

  if (gate.risks.some((risk) => risk.level === 'P0' || risk.requiresHumanApproval)) {
    return false
  }

  if (stage.id === 'product_design_review') return policy.allowAutoProductReview
  if (stage.id === 'technical_design_review') return policy.allowAutoTechnicalReview
  if (stage.id === 'implementation_unit_test') return policy.allowAutoImplementation
  if (stage.id === 'acceptance') return policy.allowAutoAcceptance
  if (stage.id === 'release') return policy.allowAutoRelease

  return true
}
