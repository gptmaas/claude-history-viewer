'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, AlertTriangle, Clock, CheckCircle, XCircle, GitBranch } from 'lucide-react'
import type { PipelineDashboard, PipelineEvent } from '@/lib/pipeline-data'

export default function PipelinePage() {
  const [dashboard, setDashboard] = useState<PipelineDashboard | null>(null)
  const [projects, setProjects] = useState<Array<{ id: number; name: string; status: string }>>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, projRes] = await Promise.all([
        fetch('/api/pipeline/dashboard'),
        fetch('/api/pipeline/projects'),
      ])
      setDashboard(await dashRes.json())
      setProjects(await projRes.json())
    } catch (err) {
      console.error('Failed to load pipeline dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6 max-w-[1400px] mx-auto space-y-6">
          <div className="animate-pulse h-8 w-32 bg-muted rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="animate-pulse h-24 bg-muted rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  const d = dashboard!

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">流水线</h1>
          </div>
          <Link
            href="/pipeline/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> 新建需求
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={<Clock className="w-5 h-5 text-blue-500" />} label="进行中" value={d.inProgressCount} />
          <StatCard icon={<AlertTriangle className="w-5 h-5 text-red-500" />} label="阻塞" value={d.blockedCount} />
          <StatCard icon={<Clock className="w-5 h-5 text-amber-500" />} label="待评审" value={d.waitingReviewCount} />
          <StatCard icon={<CheckCircle className="w-5 h-5 text-green-500" />} label="已完成" value={d.completedCount} />
          <StatCard icon={<XCircle className="w-5 h-5 text-gray-500" />} label="已放弃" value={d.abandonedCount} />
        </div>

        {/* Projects */}
        <div className="bg-card rounded-xl border">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">项目</h2>
          </div>
          {projects.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              暂无项目。创建需求时会自动创建默认项目。
            </div>
          ) : (
            <div className="divide-y divide-border">
              {projects.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent events */}
        <div className="bg-card rounded-xl border">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">最近事件</h2>
          </div>
          {d.recentEvents.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">暂无事件</div>
          ) : (
            <div className="divide-y divide-border">
              {d.recentEvents.map((e: PipelineEvent) => (
                <div key={e.id} className="px-4 py-2 flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{e.transition}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.fromStatus && `${e.fromStatus} → `}{e.toStatus}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
      {icon}
      <div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  )
}
