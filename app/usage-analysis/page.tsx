'use client'

import { useState, useEffect } from 'react'
import { ModelRequestAreaChart } from '@/components/usage-analysis/model-request-area-chart'
import { ModelTokenBarChart } from '@/components/usage-analysis/model-token-bar-chart'
import { ModelSummaryTable } from '@/components/usage-analysis/model-summary-table'
import type { UsageAnalysisData } from '@/lib/types'

type Range = '7d' | '30d' | '90d' | 'all'

export default function UsageAnalysisPage() {
  const [range, setRange] = useState<Range>('30d')
  const [data, setData] = useState<UsageAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/usage-analysis?range=${range}`)
        if (!res.ok) throw new Error('Failed to fetch')
        const json = await res.json()
        setData(json)
      } catch (e) {
        setError('加载用量分析数据失败')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [range])

  const modelNames = data?.modelSummary.map(m => m.model) || []

  const ranges: { value: Range; label: string }[] = [
    { value: '7d', label: '7 天' },
    { value: '30d', label: '30 天' },
    { value: '90d', label: '90 天' },
    { value: 'all', label: '全部' },
  ]

  function formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">用量分析</h1>
            <p className="text-sm text-muted-foreground">按模型分析 API 请求和 Token 用量</p>
          </div>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {ranges.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  range === r.value
                    ? 'bg-background shadow-sm font-medium'
                    : 'hover:bg-background/50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-20">
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">总请求数</div>
                <div className="text-2xl font-bold mt-1">{formatNumber(data.totalRequests)}</div>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">总 Token</div>
                <div className="text-2xl font-bold mt-1">{formatNumber(data.totalTokens)}</div>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">模型数</div>
                <div className="text-2xl font-bold mt-1">{data.modelSummary.length}</div>
              </div>
              <div className="bg-card rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">主要模型</div>
                <div className="text-2xl font-bold mt-1 truncate">{data.modelSummary[0]?.model || '-'}</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border p-4">
                <h2 className="text-lg font-semibold mb-4">每日 API 请求 (按模型)</h2>
                {modelNames.length > 0 ? (
                  <ModelRequestAreaChart data={data.dailyModelRequests} modelNames={modelNames} />
                ) : (
                  <p className="text-sm text-muted-foreground py-10 text-center">暂无数据</p>
                )}
              </div>
              <div className="bg-card rounded-xl border p-4">
                <h2 className="text-lg font-semibold mb-4">每日 Token 用量 (按模型)</h2>
                {modelNames.length > 0 ? (
                  <ModelTokenBarChart data={data.dailyModelTokens} modelNames={modelNames} />
                ) : (
                  <p className="text-sm text-muted-foreground py-10 text-center">暂无数据</p>
                )}
              </div>
            </div>

            {/* Model summary */}
            <div className="bg-card rounded-xl border p-4">
              <h2 className="text-lg font-semibold mb-4">模型用量汇总</h2>
              <ModelSummaryTable data={data.modelSummary} />
            </div>

            {/* Disclaimer */}
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-600 dark:text-amber-400">{data.disclaimer}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
