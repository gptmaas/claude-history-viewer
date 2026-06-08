'use client'

import type { PipelineEvent } from '@/lib/pipeline-data'
import { PIPELINE_STAGES } from '@/lib/pipeline-types'

const transitionLabels: Record<string, string> = {
  create_item: '创建需求',
  start: '开始',
  submit_artifact: '提交产物',
  submit_review: '提交评审',
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

export function EventTimeline({ events }: { events: PipelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">暂无事件</p>
  }

  return (
    <div className="space-y-0">
      {events.map((event, i) => {
        const stageTitle = event.stageId
          ? PIPELINE_STAGES.find((_, idx) => idx === event.stageId)?.title ?? `阶段 ${event.stageId}`
          : null
        return (
          <div key={event.id} className="flex gap-3 relative">
            {/* Timeline line */}
            {i < events.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
            )}
            {/* Dot */}
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 z-10 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-primary/60" />
            </div>
            {/* Content */}
            <div className="flex-1 pb-4 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {transitionLabels[event.transition] ?? event.transition}
                </span>
                {stageTitle && (
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {stageTitle}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(event.createdAt).toLocaleString('zh-CN')}
              </div>
              {event.fromStatus && event.toStatus && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {event.fromStatus} → {event.toStatus}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
