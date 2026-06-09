'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { PipelineStageDetail } from '@/lib/pipeline-data'
import { getPipelineStage } from '@/lib/pipeline-types'
import type { PipelineTransition } from '@/lib/pipeline-types'
import { getValidTransitions } from '@/lib/pipeline-state-machine'
import { StageStatusBadge } from './stage-status-badge'
import { InlineGenerator } from './inline-generator'
import { getVersionedArtifacts, type VersionedArtifact } from './artifact-viewer'
import type { GenerateType } from '@/lib/ai/prompts'
import { FileText, Sparkles, Plus, MessageSquare } from 'lucide-react'

const transitionLabels: Record<PipelineTransition, string> = {
  start: '开始',
  submit_artifact: '提交产物',
  request_review: '请求评审',
  approve: '批准',
  reject: '驳回',
  auto_pass: '自动通过',
  block: '阻塞',
  retry: '重试',
  rollback: '回退',
  advance: '推进',
  skip: '跳过',
}

const generateButtons: Record<string, Array<{ type: GenerateType; label: string }>> = {
  idea: [{ type: 'requirement', label: 'AI 补全需求' }],
  product_design_review: [
    { type: 'product_design', label: '生成产品方案' },
    { type: 'product_review', label: '生成产品评审' },
  ],
  technical_design_review: [
    { type: 'technical_design', label: '生成技术方案' },
    { type: 'task_breakdown', label: '生成任务拆分' },
    { type: 'tech_review', label: '生成技术评审' },
    { type: 'test_plan', label: '生成测试计划' },
  ],
}

interface StageMessageProps {
  stage: PipelineStageDetail
  isCurrentStage: boolean
  hasAiConfig: boolean
  itemId: number
  disabled?: boolean
  selectedArtifactId?: number | null
  onTransition: (stageId: number, transition: PipelineTransition) => void
  onAddArtifact: (stageId: number) => void
  onAddReview: (stageId: number) => void
  onSaved: () => void
  onSelectArtifact: (artifactId: number) => void
}

export function StageMessage({
  stage, isCurrentStage, hasAiConfig, itemId, disabled,
  selectedArtifactId,
  onTransition, onAddArtifact, onAddReview, onSaved, onSelectArtifact,
}: StageMessageProps) {
  const definition = getPipelineStage(stage.stageKey)
  const validTransitions = getValidTransitions(stage.status)
  const buttons = generateButtons[stage.stageKey] ?? []
  const [activeGenType, setActiveGenType] = useState<GenerateType | null>(null)

  const isDone = stage.status === 'passed' || stage.status === 'skipped' || stage.status === 'failed'
  const isFuture = stage.status === 'not_started'

  const versionedArtifacts = getVersionedArtifacts(stage.artifacts)

  return (
    <div className="fade-in-up">
      {/* Stage header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
          isDone && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
          isCurrentStage && !isDone && 'bg-primary/15 text-primary',
          isFuture && 'bg-muted text-muted-foreground/50',
          !isCurrentStage && !isDone && !isFuture && 'bg-muted text-muted-foreground',
        )}>
          {isDone ? '✓' : stage.stageIndex + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn(
              'text-sm font-semibold',
              isCurrentStage && !isDone && 'text-foreground',
              isDone && 'text-muted-foreground',
              isFuture && 'text-muted-foreground/50',
            )}>
              {definition.title}
            </h3>
            <StageStatusBadge status={stage.status} />
          </div>
          {isFuture && (
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">等待上一阶段完成</p>
          )}
        </div>
      </div>

      {/* Artifact list (compact, clickable) */}
      {versionedArtifacts.length > 0 && (
        <div className="ml-10 space-y-1 mb-3">
          {versionedArtifacts.map(({ artifact, versionLabel }) => (
            <button
              key={artifact.id}
              onClick={() => onSelectArtifact(artifact.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors',
                selectedArtifactId === artifact.id
                  ? 'bg-primary/10 ring-1 ring-primary/20'
                  : 'hover:bg-muted/50',
              )}
            >
              <FileText className="w-3.5 h-3.5 text-primary/70 shrink-0" />
              <span className="text-xs font-medium text-foreground truncate">
                {artifact.name}
                {versionLabel && (
                  <span className="text-muted-foreground font-normal ml-1">{versionLabel}</span>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto">{artifact.artifactType}</span>
            </button>
          ))}
        </div>
      )}

      {/* Reviews */}
      {stage.reviews.length > 0 && (
        <div className="ml-10 space-y-1.5 mb-3">
          {stage.reviews.map((review) => (
            <div key={review.id} className="flex items-start gap-2 text-xs px-3 py-2 rounded-md bg-muted/40">
              <MessageSquare className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'font-medium',
                  review.result === 'approved' && 'text-emerald-600 dark:text-emerald-400',
                  review.result === 'rejected' && 'text-red-600 dark:text-red-400',
                  review.result === 'needs_changes' && 'text-amber-600 dark:text-amber-400',
                )}>
                  {review.result === 'approved' ? '通过' : review.result === 'rejected' ? '驳回' : '需修改'}
                </span>
                {review.comment && (
                  <span className="text-muted-foreground ml-1.5">— {review.comment.length > 80 ? review.comment.slice(0, 80) + '...' : review.comment}</span>
                )}
                <span className="text-[10px] text-muted-foreground/60 ml-1.5">
                  {review.reviewerType === 'user' ? '用户评审' : '自动评审'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active stage actions */}
      {isCurrentStage && !isDone && (
        <div className="ml-10 space-y-3">
          {/* AI generation buttons */}
          {buttons.length > 0 && hasAiConfig && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-medium">AI 生成</p>
              <div className="flex flex-wrap gap-1.5">
                {buttons.map((btn) => (
                  <button
                    key={btn.type}
                    onClick={() => !disabled && setActiveGenType(activeGenType === btn.type ? null : btn.type)}
                    disabled={disabled}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                      disabled && 'opacity-50 cursor-not-allowed',
                      !disabled && activeGenType === btn.type
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-primary/8 text-primary hover:bg-primary/15 dark:bg-primary/10',
                    )}
                  >
                    <Sparkles className="w-3 h-3" />
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Inline generator */}
          {activeGenType && (
            <InlineGenerator
              itemId={itemId}
              stageKey={stage.stageKey}
              generateType={activeGenType}
              onSaved={() => { onSaved(); setActiveGenType(null) }}
            />
          )}

          {/* Manual actions */}
          {validTransitions.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-medium">操作</p>
              <div className="flex flex-wrap gap-1.5">
                {validTransitions.map((t) => (
                  <button
                    key={t}
                    onClick={() => !disabled && onTransition(stage.id, t)}
                    disabled={disabled}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
                      t === 'approve' || t === 'advance' ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400' :
                      t === 'reject' || t === 'block' ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400' :
                      t === 'rollback' ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400' :
                      'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400',
                    )}
                  >
                    {transitionLabels[t]}
                  </button>
                ))}
                <button
                  onClick={() => onAddArtifact(stage.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Plus className="w-3 h-3" /> 产物
                </button>
                <button
                  onClick={() => onAddReview(stage.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Plus className="w-3 h-3" /> 评审
                </button>
              </div>
            </div>
          )}

          {/* No AI config warning */}
          {buttons.length > 0 && !hasAiConfig && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              请先在设置中配置 AI 密钥以启用 AI 生成
            </p>
          )}
        </div>
      )}
    </div>
  )
}
