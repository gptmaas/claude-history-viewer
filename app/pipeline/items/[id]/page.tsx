'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, GitBranch } from 'lucide-react'
import type { PipelineItemDetail, PipelineEvent } from '@/lib/pipeline-data'
import type { PipelineTransition } from '@/lib/pipeline-types'
import { StageCard } from '@/components/pipeline/stage-card'
import { EventTimeline } from '@/components/pipeline/event-timeline'
import { AddArtifactDialog } from '@/components/pipeline/add-artifact-dialog'
import { AddReviewDialog } from '@/components/pipeline/add-review-dialog'

export default function PipelineItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = Number(params.id)

  const [item, setItem] = useState<PipelineItemDetail | null>(null)
  const [events, setEvents] = useState<PipelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [artifactStageId, setArtifactStageId] = useState<number | null>(null)
  const [reviewStageId, setReviewStageId] = useState<number | null>(null)

  const fetchItem = useCallback(async () => {
    try {
      const [itemRes, eventsRes] = await Promise.all([
        fetch(`/api/pipeline/items/${itemId}`),
        fetch(`/api/pipeline/events?itemId=${itemId}`),
      ])
      if (!itemRes.ok) {
        router.push('/pipeline')
        return
      }
      setItem(await itemRes.json())
      setEvents(await eventsRes.json())
    } catch (err) {
      console.error('Failed to load item:', err)
    } finally {
      setLoading(false)
    }
  }, [itemId, router])

  useEffect(() => { fetchItem() }, [fetchItem])

  const handleTransition = async (stageId: number, transition: PipelineTransition) => {
    try {
      await fetch(`/api/pipeline/stages/${stageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transition }),
      })
      fetchItem()
    } catch (err) {
      console.error('Transition failed:', err)
    }
  }

  const handleAddArtifact = async (stageId: number, name: string, artifactType: string, content: string) => {
    try {
      await fetch(`/api/pipeline/stages/${stageId}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, artifactType, content }),
      })
      fetchItem()
    } catch (err) {
      console.error('Add artifact failed:', err)
    }
  }

  const handleAddReview = async (stageId: number, result: string, comment: string) => {
    try {
      await fetch(`/api/pipeline/stages/${stageId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, comment }),
      })
      fetchItem()
    } catch (err) {
      console.error('Add review failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6 space-y-4">
          <div className="animate-pulse h-8 w-64 bg-muted rounded" />
          <div className="animate-pulse h-40 bg-muted rounded-xl" />
          <div className="animate-pulse h-40 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  if (!item) return null

  const statusLabels: Record<string, string> = {
    in_progress: '进行中',
    completed: '已完成',
    abandoned: '已放弃',
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link href="/pipeline" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <GitBranch className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">{item.title}</h1>
          </div>
          <div className="flex items-center gap-2 ml-8">
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
              {statusLabels[item.overallStatus] ?? item.overallStatus}
            </span>
            <span className="text-xs text-muted-foreground">优先级: {item.priority}</span>
          </div>
        </div>

        {/* Metadata */}
        {(item.background || (item.goals && item.goals.length > 0) || (item.acceptanceCriteria && item.acceptanceCriteria.length > 0)) && (
          <div className="bg-card rounded-xl border p-4 space-y-3">
            {item.background && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">背景</h3>
                <p className="text-sm text-foreground whitespace-pre-wrap">{item.background}</p>
              </div>
            )}
            {item.goals && item.goals.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">目标</h3>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                  {item.goals.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}
            {item.acceptanceCriteria && item.acceptanceCriteria.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">验收标准</h3>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1">
                  {item.acceptanceCriteria.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Stage track */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">阶段轨道</h2>
          {item.stages.map((stage) => (
            <StageCard
              key={stage.id}
              stage={stage}
              isCurrentStage={stage.stageIndex === item.currentStageIndex}
              onTransition={handleTransition}
              onAddArtifact={(id) => setArtifactStageId(id)}
              onAddReview={(id) => setReviewStageId(id)}
            />
          ))}
        </div>

        {/* Events */}
        <div className="bg-card rounded-xl border p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">事件日志</h2>
          <EventTimeline events={events} />
        </div>
      </div>

      {/* Dialogs */}
      <AddArtifactDialog
        open={artifactStageId !== null}
        onOpenChange={(open) => { if (!open) setArtifactStageId(null) }}
        onSubmit={(name, type, content) => {
          if (artifactStageId) handleAddArtifact(artifactStageId, name, type, content)
        }}
      />
      <AddReviewDialog
        open={reviewStageId !== null}
        onOpenChange={(open) => { if (!open) setReviewStageId(null) }}
        onSubmit={(result, comment) => {
          if (reviewStageId) handleAddReview(reviewStageId, result, comment)
        }}
      />
    </div>
  )
}
