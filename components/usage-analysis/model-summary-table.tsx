'use client'

import type { ModelUsageSummary } from '@/lib/types'

interface Props {
  data: ModelUsageSummary[]
}

const COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16']

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

export function ModelSummaryTable({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">暂无数据</p>
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={item.model} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: COLORS[index % COLORS.length] }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{item.model}</span>
              <span className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span>请求: {formatNumber(item.requestCount)}</span>
              <span>输入: {formatNumber(item.inputTokens)}</span>
              <span>输出: {formatNumber(item.outputTokens)}</span>
              <span className="font-medium text-foreground">总计: {formatNumber(item.totalTokens)}</span>
            </div>
            <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
