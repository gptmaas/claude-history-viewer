'use client'

import type { PipelineStageDetail } from '@/lib/pipeline-data'
import type { PipelineTransition } from '@/lib/pipeline-types'
import { getPipelineStage } from '@/lib/pipeline-types'
import { getValidTransitions } from '@/lib/pipeline-state-machine'
import { StageStatusBadge } from './stage-status-badge'
import { ChevronDown, ChevronUp, Plus, FileText, MessageSquare } from 'lucide-react'
import { useState } from 'react'

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

interface StageCardProps {
  stage: PipelineStageDetail
  isCurrentStage: boolean
  onTransition: (stageId: number, transition: PipelineTransition) => void
  onAddArtifact: (stageId: number) => void
  onAddReview: (stageId: number) => void
}

export function StageCard({ stage, isCurrentStage, onTransition, onAddArtifact, onAddReview }: StageCardProps) {
  const [expanded, setExpanded] = useState(isCurrentStage)
  const definition = getPipelineStage(stage.stageKey)
  const validTransitions = getValidTransitions(stage.status)

  return (
    <div className={cn(
      'border rounded-lg bg-card',
      isCurrentStage && 'ring-2 ring-primary/30 border-primary/50',
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
          {stage.stageIndex + 1}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground">{definition.title}</h3>
        </div>
        <StageStatusBadge status={stage.status} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {stage.artifacts.length > 0 && (
            <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{stage.artifacts.length}</span>
          )}
          {stage.reviews.length > 0 && (
            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{stage.reviews.length}</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          {/* Time info */}
          {stage.startedAt && (
            <div className="pt-3 text-xs text-muted-foreground">
              开始: {new Date(stage.startedAt).toLocaleString('zh-CN')}
              {stage.completedAt && ` → 完成: ${new Date(stage.completedAt).toLocaleString('zh-CN')}`}
            </div>
          )}

          {/* Action buttons */}
          {validTransitions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {validTransitions.map((t) => (
                <button
                  key={t}
                  onClick={() => onTransition(stage.id, t)}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-medium transition-colors',
                    t === 'approve' || t === 'advance' ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60' :
                    t === 'reject' || t === 'block' ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60' :
                    t === 'rollback' ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300' :
                    'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300',
                  )}
                >
                  {transitionLabels[t]}
                </button>
              ))}
              <button
                onClick={() => onAddArtifact(stage.id)}
                className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <Plus className="w-3 h-3" /> 产物
              </button>
              <button
                onClick={() => onAddReview(stage.id)}
                className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                <Plus className="w-3 h-3" /> 评审
              </button>
            </div>
          )}

          {/* Artifacts */}
          {stage.artifacts.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">产物</h4>
              {stage.artifacts.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground truncate">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{a.artifactType}</span>
                </div>
              ))}
            </div>
          )}

          {/* Reviews */}
          {stage.reviews.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">评审</h4>
              {stage.reviews.map((r) => (
                <div key={r.id} className="text-sm p-2 rounded bg-muted/50">
                  <span className={cn(
                    'font-medium',
                    r.result === 'approved' ? 'text-green-600 dark:text-green-400' :
                    r.result === 'rejected' ? 'text-red-600 dark:text-red-400' :
                    'text-amber-600 dark:text-amber-400',
                  )}>
                    {r.result === 'approved' ? '通过' : r.result === 'rejected' ? '驳回' : '需修改'}
                  </span>
                  {r.comment && <span className="ml-2 text-muted-foreground">— {r.comment}</span>}
                  <span className="ml-2 text-xs text-muted-foreground">{r.reviewerType === 'user' ? '用户' : '自动'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function cn(...inputs: (string | boolean | undefined | null)[]) {
  return inputs.filter(Boolean).join(' ')
}
