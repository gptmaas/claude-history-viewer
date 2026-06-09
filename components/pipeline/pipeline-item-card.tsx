'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Clock, CheckCircle, XCircle, AlertTriangle, GitBranch } from 'lucide-react'

interface PipelineItemCardProps {
  id: number
  title: string
  priority: string
  overallStatus: string
  currentStageIndex: number
  currentStageName: string
  createdAt: string
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string; barColor: string }> = {
  in_progress: {
    icon: <Clock className="w-3.5 h-3.5" />,
    label: '进行中',
    color: 'text-blue-600 dark:text-blue-400',
    barColor: 'bg-blue-500',
  },
  completed: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    label: '已完成',
    color: 'text-emerald-600 dark:text-emerald-400',
    barColor: 'bg-emerald-500',
  },
  abandoned: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    label: '已放弃',
    color: 'text-gray-500 dark:text-gray-400',
    barColor: 'bg-gray-400',
  },
}

const priorityConfig: Record<string, string> = {
  P0: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  P1: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  P2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  P3: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export function PipelineItemCard({
  id, title, priority, overallStatus, currentStageIndex, currentStageName, createdAt,
}: PipelineItemCardProps) {
  const config = statusConfig[overallStatus] ?? statusConfig.in_progress
  const priorityClass = priorityConfig[priority] ?? priorityConfig.P2

  return (
    <Link href={`/pipeline/items/${id}`} className="block group">
      <div className="relative flex gap-0 rounded-lg border border-border/60 bg-card overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all duration-200">
        {/* Status bar */}
        <div className={cn('w-1 shrink-0', config.barColor)} />

        <div className="flex-1 px-4 py-3 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {title}
            </h3>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0', priorityClass)}>
              {priority}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className={cn('flex items-center gap-1', config.color)}>
              {config.icon} {config.label}
            </span>
            {overallStatus === 'in_progress' && (
              <span className="flex items-center gap-1">
                <GitBranch className="w-3 h-3" />
                {currentStageName}
              </span>
            )}
            <span className="ml-auto text-[10px]">
              {new Date(createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
