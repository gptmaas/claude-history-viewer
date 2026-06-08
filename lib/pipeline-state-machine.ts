import type { PipelineStageStatus, PipelineTransition } from './pipeline-types'

const VALID_TRANSITIONS: Record<PipelineStageStatus, PipelineTransition[]> = {
  not_started: ['start', 'skip'],
  running: ['submit_artifact', 'request_review', 'block', 'advance'],
  waiting_review: ['approve', 'reject', 'block'],
  blocked: ['retry', 'rollback', 'skip'],
  passed: ['rollback'],
  failed: ['retry', 'rollback', 'skip'],
  skipped: ['rollback'],
}

const TRANSITION_RESULT: Record<PipelineTransition, PipelineStageStatus> = {
  start: 'running',
  submit_artifact: 'running',
  request_review: 'waiting_review',
  approve: 'passed',
  reject: 'failed',
  auto_pass: 'passed',
  block: 'blocked',
  retry: 'running',
  rollback: 'not_started',
  advance: 'passed',
  skip: 'skipped',
}

export function isValidTransition(currentStatus: PipelineStageStatus, transition: PipelineTransition): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(transition) ?? false
}

export function applyTransition(currentStatus: PipelineStageStatus, transition: PipelineTransition): PipelineStageStatus {
  if (!isValidTransition(currentStatus, transition)) {
    throw new Error(`Invalid transition '${transition}' from status '${currentStatus}'`)
  }
  return TRANSITION_RESULT[transition]
}

export function getValidTransitions(currentStatus: PipelineStageStatus): PipelineTransition[] {
  return VALID_TRANSITIONS[currentStatus] ?? []
}
