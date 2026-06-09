'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Send, ArrowRight, GitBranch, Shield, Loader2 } from 'lucide-react'
import type { PipelineDashboard } from '@/lib/pipeline-data'
import { PipelineItemCard } from '@/components/pipeline/pipeline-item-card'
import { PIPELINE_STAGES } from '@/lib/pipeline-types'

const SUGGESTIONS = ['优化功能体验', '修复已知 Bug', '添加新特性', '代码重构']

export default function PipelinePage() {
  const router = useRouter()
  const [dashboard, setDashboard] = useState<PipelineDashboard | null>(null)
  const [items, setItems] = useState<Array<{
    id: number; title: string; priority: string; overallStatus: string
    currentStageIndex: number; createdAt: string
  }>>([])
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [inputValue, setInputValue] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, projRes] = await Promise.all([
        fetch('/api/pipeline/dashboard'),
        fetch('/api/pipeline/projects'),
      ])
      setDashboard(await dashRes.json())
      const projectsData = await projRes.json()
      setProjects(projectsData)

      // Fetch all items across projects
      const allItems: typeof items = []
      for (const p of projectsData) {
        const itemsRes = await fetch(`/api/pipeline/items?projectId=${p.id}`)
        const projectItems = await itemsRes.json()
        for (const item of projectItems) {
          const detailRes = await fetch(`/api/pipeline/items/${item.id}`)
          const detail = await detailRes.json()
          allItems.push({
            id: detail.id,
            title: detail.title,
            priority: detail.priority,
            overallStatus: detail.overallStatus,
            currentStageIndex: detail.currentStageIndex,
            createdAt: detail.createdAt,
          })
        }
      }
      allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setItems(allItems)
    } catch (err) {
      console.error('Failed to load pipeline dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleQuickCreate = async () => {
    const title = inputValue.trim()
    if (!title || creating) return
    setCreating(true)
    try {
      let projectId = projects[0]?.id
      if (!projectId) {
        const res = await fetch('/api/pipeline/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '默认项目' }),
        })
        const project = await res.json()
        projectId = project.id
        setProjects([project])
      }

      const res = await fetch('/api/pipeline/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title, priority: 'P2' }),
      })
      const item = await res.json()
      router.push(`/pipeline/items/${item.id}`)
    } catch (err) {
      console.error('Failed to create item:', err)
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-12 space-y-6">
          <div className="animate-pulse h-8 w-32 bg-muted rounded mx-auto" />
          <div className="animate-pulse h-12 bg-muted rounded-xl" />
          <div className="animate-pulse h-24 bg-muted rounded-xl" />
          <div className="animate-pulse h-24 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  const d = dashboard!

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-12 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3 fade-in-up">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-2">
            <GitBranch className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">AI 驱动的软件开发流水线</p>
        </div>

        {/* Input */}
        <div className="fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex gap-2 p-1.5 rounded-xl border border-border bg-card shadow-sm focus-within:border-primary/40 focus-within:shadow-md focus-within:shadow-primary/5 transition-all">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickCreate()}
              placeholder="描述你的需求想法..."
              className="flex-1 px-3 py-2.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              disabled={creating}
            />
            <button
              onClick={handleQuickCreate}
              disabled={!inputValue.trim() || creating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors shrink-0"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {creating ? '创建中' : '开始'}
            </button>
          </div>

          {/* Suggestion chips */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setInputValue(s)}
                className="px-3 py-1.5 rounded-full text-xs text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground fade-in-up" style={{ animationDelay: '0.2s' }}>
          {d.inProgressCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {d.inProgressCount} 进行中</span>}
          {d.waitingReviewCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {d.waitingReviewCount} 待评审</span>}
          {d.blockedCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {d.blockedCount} 阻塞</span>}
          {d.completedCount > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {d.completedCount} 已完成</span>}
          {d.inProgressCount + d.waitingReviewCount + d.blockedCount + d.completedCount === 0 && (
            <span>暂无需求</span>
          )}
        </div>

        {/* Items list */}
        {items.length > 0 && (
          <div className="space-y-3 fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">最近需求</h2>
              {d.waitingReviewCount + d.blockedCount > 0 && (
                <Link
                  href="/pipeline/gates"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Shield className="w-3 h-3" />
                  门禁中心 ({d.waitingReviewCount + d.blockedCount})
                </Link>
              )}
            </div>

            {items.map((item) => (
              <PipelineItemCard
                key={item.id}
                {...item}
                currentStageName={PIPELINE_STAGES[item.currentStageIndex]?.title ?? '未知'}
              />
            ))}
          </div>
        )}

        {/* Advanced creation link */}
        <div className="text-center fade-in-up" style={{ animationDelay: '0.4s' }}>
          <Link
            href="/pipeline/new"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            或使用完整表单创建 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
