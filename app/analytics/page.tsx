'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ActivityTimeline } from '@/components/analytics/activity-timeline'
import { ToolUsageChart } from '@/components/analytics/tool-usage-chart'
import { SessionDurationChart } from '@/components/analytics/session-duration-chart'
import { HourlyHeatmap } from '@/components/analytics/hourly-heatmap'
import { ProjectHeatmap } from '@/components/analytics/project-heatmap'
import { SourceBreakdownChart } from '@/components/analytics/source-breakdown-chart'
import { TokenEstimationCard } from '@/components/analytics/token-estimation-card'
import type { AnalyticsStats } from '@/lib/types'

type Range = '7d' | '30d' | '90d' | 'all'

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>('30d')
  const [stats, setStats] = useState<AnalyticsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/analytics?range=${range}`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setStats(data)
      } catch (e) {
        setError('加载分析数据失败')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [range])

  const ranges: { value: Range; label: string }[] = [
    { value: '7d', label: '7 天' },
    { value: '30d', label: '30 天' },
    { value: '90d', label: '90 天' },
    { value: 'all', label: '全部' },
  ]

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">数据分析</h1>
            <p className="text-sm text-muted-foreground">了解你的 AI 编码模式</p>
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

        {stats && !loading && (
          <div className="space-y-6">
            {/* Top row: Activity Timeline + Project Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border p-4">
                <h2 className="text-lg font-semibold mb-4">活动时间线</h2>
                <ActivityTimeline data={stats.dailyActivity} />
              </div>
              <div className="bg-card rounded-xl border p-4">
                <h2 className="text-lg font-semibold mb-4">项目活动热力图</h2>
                <ProjectHeatmap data={stats.projectActivityHeatmap} />
              </div>
            </div>

            {/* Tool Usage + Session Duration */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border p-4">
                <h2 className="text-lg font-semibold mb-4">工具使用统计</h2>
                {stats.toolUsageStats.length > 0 ? (
                  <ToolUsageChart data={stats.toolUsageStats} />
                ) : (
                  <p className="text-sm text-muted-foreground py-10 text-center">暂无数据</p>
                )}
              </div>

              <div className="bg-card rounded-xl border p-4">
                <h2 className="text-lg font-semibold mb-4">会话时长分布</h2>
                <SessionDurationChart data={stats.sessionDurationStats} />
              </div>
            </div>

            {/* Hourly Heatmap */}
            <div className="bg-card rounded-xl border p-4">
              <h2 className="text-lg font-semibold mb-4">每小时活跃度</h2>
              <HourlyHeatmap data={stats.sessionsByHourOfDay} />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>0:00</span>
                <span>6:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </div>

            {/* Day of Week + Source Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border p-4">
                <h2 className="text-lg font-semibold mb-4">每周活跃分布</h2>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.sessionsByDayOfWeek} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="dayName" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      />
                      <Bar dataKey="count" name="消息数" radius={[4, 4, 0, 0]}>
                        {stats.sessionsByDayOfWeek.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 || index === 6 ? '#3b82f6' : '#14b8a6'}
                            fillOpacity={index === 0 || index === 6 ? 0.9 : 0.7}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card rounded-xl border p-4">
                <h2 className="text-lg font-semibold mb-4">来源分布</h2>
                {stats.sourceBreakdown.length > 0 ? (
                  <SourceBreakdownChart data={stats.sourceBreakdown} />
                ) : (
                  <p className="text-sm text-muted-foreground py-10 text-center">暂无数据</p>
                )}
              </div>
            </div>

            {/* Token Estimation */}
            <div className="bg-card rounded-xl border p-4">
              <h2 className="text-lg font-semibold mb-4">Token 使用估算</h2>
              <TokenEstimationCard data={stats.estimatedTokenUsage} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
