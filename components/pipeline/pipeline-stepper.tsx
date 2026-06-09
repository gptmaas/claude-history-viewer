'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { PipelineStageDetail } from '@/lib/pipeline-data'
import { PIPELINE_STAGES } from '@/lib/pipeline-types'
import { Check, ChevronRight, ChevronDown, FileText, MessageSquare } from 'lucide-react'
import { getVersionedArtifacts } from './artifact-viewer'

interface PipelineStepperProps {
  stages: PipelineStageDetail[]
  currentStageIndex: number
  selectedIndex: number | null
  onSelect: (stageIndex: number) => void
  onSelectArtifact: (artifactId: number) => void
}

export function PipelineStepper({ stages, currentStageIndex, selectedIndex, onSelect, onSelectArtifact }: PipelineStepperProps) {
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set())

  const toggleExpand = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedStages(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <nav className="space-y-0.5">
      {PIPELINE_STAGES.map((def, idx) => {
        const stage = stages.find(s => s.stageKey === def.id)
        const isCompleted = stage && (stage.status === 'passed' || stage.status === 'skipped')
        const isCurrent = idx === currentStageIndex
        const isSelected = idx === selectedIndex
        const isFuture = !stage || stage.status === 'not_started'
        const hasContent = stage && (stage.artifacts.length > 0 || stage.reviews.length > 0)
        const expanded = expandedStages.has(idx)

        return (
          <div key={def.id}>
            <div
              onClick={() => onSelect(idx)}
              className={cn(
                'group flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-left transition-all duration-150 cursor-pointer relative',
                isSelected && !isFuture && 'bg-primary/8 ring-1 ring-primary/15',
                !isSelected && !isFuture && 'hover:bg-muted/60',
                isFuture && 'cursor-default opacity-50',
              )}
            >
              {/* Left accent bar for selected */}
              {isSelected && !isFuture && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />
              )}

              {/* Status dot */}
              <div className="shrink-0">
                {isCompleted ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                ) : isCurrent && !isFuture ? (
                  <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center pipeline-stepper-active">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-muted-foreground/20 flex items-center justify-center">
                    <span className="text-[9px] font-medium text-muted-foreground/40">{idx + 1}</span>
                  </div>
                )}
              </div>

              {/* Title */}
              <span className={cn(
                'text-[12px] font-medium truncate flex-1 min-w-0',
                isSelected && 'text-foreground',
                !isSelected && isCompleted && 'text-muted-foreground',
                !isSelected && isCurrent && !isCompleted && 'text-foreground',
                isFuture && 'text-muted-foreground/50',
              )}>
                {def.title}
              </span>

              {/* Count badges */}
              {hasContent && !expanded && (
                <div className="flex items-center gap-1">
                  {stage!.artifacts.length > 0 && (
                    <span className="text-[9px] tabular-nums bg-muted px-1 py-px rounded text-muted-foreground">
                      {stage!.artifacts.length}
                    </span>
                  )}
                </div>
              )}

              {/* Expand arrow */}
              {hasContent && (
                <button
                  onClick={(e) => toggleExpand(idx, e)}
                  className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  {expanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>

            {/* Expanded sub-items */}
            {expanded && hasContent && (
              <div className="ml-[30px] mr-2 space-y-0.5 py-0.5">
                {stage && getVersionedArtifacts(stage.artifacts).map(({ artifact, versionLabel }) => (
                  <div
                    key={artifact.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onSelectArtifact(artifact.id) }}
                  >
                    <FileText className="w-3 h-3 shrink-0" />
                    <span className="truncate">{artifact.name}</span>
                    {versionLabel && <span className="text-[9px] text-muted-foreground/60">{versionLabel}</span>}
                  </div>
                ))}
                {stage!.reviews.map(r => (
                  <div key={r.id} className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onSelect(idx) }}
                  >
                    <MessageSquare className="w-3 h-3 shrink-0" />
                    <span className={cn(
                      'truncate',
                      r.result === 'approved' && 'text-emerald-600 dark:text-emerald-400',
                      r.result === 'rejected' && 'text-red-600 dark:text-red-400',
                      r.result === 'needs_changes' && 'text-amber-600 dark:text-amber-400',
                    )}>
                      {r.result === 'approved' ? '通过' : r.result === 'rejected' ? '驳回' : '需修改'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
