'use client'

import type { TokenUsageEstimate } from '@/lib/types'

interface Props {
  data: TokenUsageEstimate
}

export function TokenEstimationCard({ data }: Props) {
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <div className="text-xl font-bold">{formatNumber(data.estimatedInputTokens)}</div>
          <div className="text-xs text-muted-foreground">估算输入 Token</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-muted/50">
          <div className="text-xl font-bold">{formatNumber(data.estimatedOutputTokens)}</div>
          <div className="text-xs text-muted-foreground">估算输出 Token</div>
        </div>
        <div className="text-center p-3 rounded-lg bg-primary/10">
          <div className="text-xl font-bold text-primary">{formatNumber(data.estimatedTotalTokens)}</div>
          <div className="text-xs text-muted-foreground">估算总计 Token</div>
        </div>
      </div>

      {data.bySource.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">按来源分布</div>
          {data.bySource.map((item) => (
            <div key={item.sourceType} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.sourceType}</span>
              <div className="flex gap-4">
                <span className="text-muted-foreground">输入: {formatNumber(item.inputTokens)}</span>
                <span className="text-muted-foreground">输出: {formatNumber(item.outputTokens)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-2 rounded bg-amber-500/10 border border-amber-500/20">
        <p className="text-xs text-amber-600 dark:text-amber-400">{data.disclaimer}</p>
      </div>
    </div>
  )
}
