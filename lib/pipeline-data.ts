import type { PipelineStageId, PipelineStageStatus, PipelineSessionLinkType } from './pipeline-types'

export interface PipelineProject {
  id: number
  name: string
  description: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface PipelineItem {
  id: number
  projectId: number
  title: string
  background: string | null
  goals: string[] | null
  acceptanceCriteria: string[] | null
  currentStageIndex: number
  overallStatus: string
  priority: string
  sourceSessionId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PipelineStageRow {
  id: number
  itemId: number
  stageKey: PipelineStageId
  stageIndex: number
  status: PipelineStageStatus
  startedAt: Date | null
  completedAt: Date | null
  updatedAt: Date
}

export interface PipelineArtifact {
  id: number
  stageId: number
  name: string
  artifactType: string
  content: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PipelineReview {
  id: number
  stageId: number
  result: string
  comment: string | null
  reviewerType: string
  createdAt: Date
}

export interface PipelineEvent {
  id: number
  itemId: number
  stageId: number | null
  transition: string
  fromStatus: string | null
  toStatus: string | null
  detail: Record<string, unknown> | null
  createdAt: Date
}

export interface PipelineSessionLink {
  id: number
  itemId: number
  stageId: number | null
  sessionId: string
  linkType: PipelineSessionLinkType
  note: string | null
  createdAt: Date
}

export interface PipelineStageDetail extends PipelineStageRow {
  artifacts: PipelineArtifact[]
  reviews: PipelineReview[]
}

export interface PipelineItemDetail extends PipelineItem {
  stages: PipelineStageDetail[]
}

export interface CreatePipelineItemInput {
  projectId: number
  title: string
  background?: string
  goals?: string[]
  acceptanceCriteria?: string[]
  priority?: string
  sourceSessionId?: string
}

export interface PipelineDashboard {
  inProgressCount: number
  blockedCount: number
  waitingReviewCount: number
  completedCount: number
  abandonedCount: number
  recentEvents: PipelineEvent[]
}
