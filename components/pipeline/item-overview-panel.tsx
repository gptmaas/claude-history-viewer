'use client'

import { cn } from '@/lib/utils'
import type { PipelineItemDetail, PipelineEvent } from '@/lib/pipeline-data'
import { EventTimeline } from './event-timeline'
import { FileText, ChevronRight, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getPipelineStage } from '@/lib/pipeline-types'

interface ItemOverviewPanelProps {
  item: PipelineItemDetail
  events: PipelineEvent[]
}

export function ItemOverviewPanel({ item, events }: ItemOverviewPanelProps) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null)

  const statusLabels: Record<string, string> = {
    in_progress: '进行中',
    completed: '已完成',
    abandoned: '已放弃',
  }

  const totalArtifacts = item.stages.reduce((sum, s) => sum + s.artifacts.length, 0)
  const totalReviews = item.stages.reduce((sum, s) => sum + s.reviews.length, 0)

  return (
    <div className="space-y-6 fade-in-up">
      {/* Item metadata */}
      <section>
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">需求信息</h3>
        <div className="space-y-2">
          {item.background && (
            <p className="text-xs text-foreground/80 leading-relaxed">{item.background}</p>
          )}
          {item.goals && item.goals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.goals.map((g, i) => (
                <span key={i} className="text-[10px] bg-primary/8 text-primary px-2 py-0.5 rounded-md">
                  {g}
                </span>
              ))}
            </div>
          )}
          {item.acceptanceCriteria && item.acceptanceCriteria.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">验收标准</p>
              <ul className="text-xs text-foreground/70 space-y-0.5">
                {item.acceptanceCriteria.map((a, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-muted-foreground shrink-0">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Summary stats */}
      <section>
        <div className="flex gap-3">
          <div className="flex-1 p-3 rounded-lg bg-muted/40 border border-border/40">
            <div className="text-lg font-bold text-foreground">{totalArtifacts}</div>
            <div className="text-[10px] text-muted-foreground">产物总数</div>
          </div>
          <div className="flex-1 p-3 rounded-lg bg-muted/40 border border-border/40">
            <div className="text-lg font-bold text-foreground">{totalReviews}</div>
            <div className="text-[10px] text-muted-foreground">评审总数</div>
          </div>
          <div className="flex-1 p-3 rounded-lg bg-muted/40 border border-border/40">
            <div className="text-lg font-bold text-foreground">{events.length}</div>
            <div className="text-[10px] text-muted-foreground">事件总数</div>
          </div>
        </div>
      </section>

      {/* All artifacts grouped by stage */}
      <section>
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">全部产物</h3>
        <div className="space-y-1">
          {item.stages
            .filter(s => s.artifacts.length > 0 || s.reviews.length > 0)
            .map(stage => {
              const def = getPipelineStage(stage.stageKey)
              const isExpanded = expandedStage === stage.stageKey
              return (
                <div key={stage.id} className="border border-border/50 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedStage(isExpanded ? null : stage.stageKey)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-medium text-foreground">{def.title}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {stage.artifacts.length} 产物 · {stage.reviews.length} 评审
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2 border-t border-border/30">
                      {stage.artifacts.map(a => (
                        <div key={a.id} className="pt-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <FileText className="w-3 h-3 text-primary/70" />
                            <span className="text-[11px] font-medium text-foreground">{a.name}</span>
                            <span className="text-[9px] text-muted-foreground">{a.artifactType}</span>
                          </div>
                          {a.content && (
                            <div className="prose prose-sm dark:prose-invert max-w-none mt-2 leading-relaxed max-h-[300px] overflow-y-auto bg-muted/20 rounded p-3">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.content}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          {item.stages.filter(s => s.artifacts.length > 0 || s.reviews.length > 0).length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">暂无产物</p>
          )}
        </div>
      </section>

      {/* Event timeline */}
      <section>
        <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">事件日志</h3>
        <div className="max-h-[400px] overflow-y-auto">
          <EventTimeline events={events} />
        </div>
      </section>
    </div>
  )
}
