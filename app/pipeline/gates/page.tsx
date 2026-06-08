'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, GitBranch, AlertTriangle, Clock } from 'lucide-react'
import type { PipelineItemDetail } from '@/lib/pipeline-data'
import { StageStatusBadge } from '@/components/pipeline/stage-status-badge'
import { getPipelineStage } from '@/lib/pipeline-types'
import type { PipelineTransition } from '@/lib/pipeline-types'

export default function GatesPage() {
  const [waitingReview, setWaitingReview] = useState<Array<{ item: PipelineItemDetail; stageId: number; stageKey: string; stageStatus: string }>>([])
  const [blocked, setBlocked] = useState<Array<{ item: PipelineItemDetail; stageId: number; stageKey: string; stageStatus: string }>>([])
  const [loading, setLoading] = useState(true)

  const fetchGates = useCallback(async () => {
    try {
      const projRes = await fetch('/api/pipeline/projects')
      const projects: Array<{ id: number }> = await projRes.json()

      const allItems: PipelineItemDetail[] = []
      for (const p of projects) {
        const itemsRes = await fetch(`/api/pipeline/items?projectId=${p.id}`)
        const items: Array<{ id: number }> = await itemsRes.json()
        for (const item of items) {
          const detailRes = await fetch(`/api/pipeline/items/${item.id}`)
          const detail = await detailRes.json()
          allItems.push(detail)
        }
      }

      const wr: typeof waitingReview = []
      const bl: typeof blocked = []

      for (const item of allItems) {
        for (const stage of item.stages) {
          if (stage.status === 'waiting_review') {
            wr.push({ item, stageId: stage.id, stageKey: stage.stageKey, stageStatus: stage.status })
          }
          if (stage.status === 'blocked') {
            bl.push({ item, stageId: stage.id, stageKey: stage.stageKey, stageStatus: stage.status })
          }
        }
      }

      setWaitingReview(wr)
      setBlocked(bl)
    } catch (err) {
      console.error('Failed to load gates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGates() }, [fetchGates])

  const handleTransition = async (stageId: number, transition: PipelineTransition) => {
    try {
      await fetch(`/api/pipeline/stages/${stageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transition }),
      })
      fetchGates()
    } catch (err) {
      console.error('Transition failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 space-y-4">
          <div className="animate-pulse h-8 w-48 bg-muted rounded" />
          <div className="animate-pulse h-32 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/pipeline" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <GitBranch className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">门禁中心</h1>
        </div>

        {/* Waiting for review */}
        <div className="bg-card rounded-xl border">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-foreground">待评审 ({waitingReview.length})</h2>
          </div>
          {waitingReview.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">暂无待评审项</div>
          ) : (
            <div className="divide-y divide-border">
              {waitingReview.map(({ item, stageId, stageKey }) => (
                <div key={stageId} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <Link href={`/pipeline/items/${item.id}`} className="text-sm font-medium text-foreground hover:underline">
                      {item.title}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {getPipelineStage(stageKey as never).title}
                    </div>
                  </div>
                  <StageStatusBadge status="waiting_review" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTransition(stageId, 'approve')}
                      className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 transition-colors"
                    >
                      批准
                    </button>
                    <button
                      onClick={() => handleTransition(stageId, 'reject')}
                      className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 transition-colors"
                    >
                      驳回
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blocked */}
        <div className="bg-card rounded-xl border">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-foreground">阻塞 ({blocked.length})</h2>
          </div>
          {blocked.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">暂无阻塞项</div>
          ) : (
            <div className="divide-y divide-border">
              {blocked.map(({ item, stageId, stageKey }) => (
                <div key={stageId} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <Link href={`/pipeline/items/${item.id}`} className="text-sm font-medium text-foreground hover:underline">
                      {item.title}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {getPipelineStage(stageKey as never).title}
                    </div>
                  </div>
                  <StageStatusBadge status="blocked" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTransition(stageId, 'retry')}
                      className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 transition-colors"
                    >
                      重试
                    </button>
                    <button
                      onClick={() => handleTransition(stageId, 'rollback')}
                      className="px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-300 transition-colors"
                    >
                      回退
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
