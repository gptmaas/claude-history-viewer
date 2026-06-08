'use client'

import type { PipelineStageStatus } from '@/lib/pipeline-types'
import { cn } from '@/lib/utils'

const statusConfig: Record<PipelineStageStatus, { label: string; className: string }> = {
  not_started: { label: '未开始', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  running: { label: '进行中', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  waiting_review: { label: '待评审', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  blocked: { label: '阻塞', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  passed: { label: '通过', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  failed: { label: '失败', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  skipped: { label: '跳过', className: 'bg-gray-100 text-gray-500 line-through dark:bg-gray-800 dark:text-gray-500' },
}

export function StageStatusBadge({ status, className }: { status: PipelineStageStatus; className?: string }) {
  const config = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.className, className)}>
      {config.label}
    </span>
  )
}
