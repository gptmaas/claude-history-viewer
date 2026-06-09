'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Zap, Layers, Activity } from 'lucide-react'
import type { PipelineItemDetail, PipelineEvent } from '@/lib/pipeline-data'
import type { PipelineTransition } from '@/lib/pipeline-types'
import { cn } from '@/lib/utils'
import { PipelineStepper } from '@/components/pipeline/pipeline-stepper'
import { StageMessage } from '@/components/pipeline/stage-message'
import { ItemOverviewPanel } from '@/components/pipeline/item-overview-panel'
import { AddArtifactDialog } from '@/components/pipeline/add-artifact-dialog'
import { AddReviewDialog } from '@/components/pipeline/add-review-dialog'
import { ArtifactViewer, getVersionedArtifacts } from '@/components/pipeline/artifact-viewer'
import { AutopilotProgress, initialAutopilotState, initializeSteps, type AutopilotState } from '@/components/pipeline/autopilot-progress'

type TabKey = 'detail' | 'overview'

export default function PipelineItemDetailPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = Number(params.id)
  const abortRef = useRef<AbortController | null>(null)
  const initializedRef = useRef(false)

  const [item, setItem] = useState<PipelineItemDetail | null>(null)
  const [events, setEvents] = useState<PipelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [artifactStageId, setArtifactStageId] = useState<number | null>(null)
  const [reviewStageId, setReviewStageId] = useState<number | null>(null)
  const [hasAiConfig, setHasAiConfig] = useState(false)
  const [autopilot, setAutopilot] = useState<AutopilotState>(initialAutopilotState)

  const [selectedStageIndex, setSelectedStageIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('detail')
  const [selectedArtifactId, setSelectedArtifactId] = useState<number | null>(null)

  const fetchItem = useCallback(async () => {
    try {
      const [itemRes, eventsRes] = await Promise.all([
        fetch(`/api/pipeline/items/${itemId}`),
        fetch(`/api/pipeline/events?itemId=${itemId}`),
      ])
      if (!itemRes.ok) { router.push('/pipeline'); return }
      const data = await itemRes.json()
      setItem(data)
      setEvents(await eventsRes.json())
      if (!initializedRef.current) {
        initializedRef.current = true
        setSelectedStageIndex(data.currentStageIndex ?? 0)
      }
    } catch (err) {
      console.error('Failed to load item:', err)
    } finally {
      setLoading(false)
    }
  }, [itemId, router])

  useEffect(() => { fetchItem() }, [fetchItem])

  useEffect(() => {
    fetch('/api/settings/ai').then(r => r.json()).then((configs: Array<{ isActive: number; apiKeySet: boolean }>) => {
      setHasAiConfig(configs.some(c => c.isActive && c.apiKeySet))
    }).catch(() => {})
  }, [])

  const handleTransition = async (stageId: number, transition: PipelineTransition) => {
    try {
      await fetch(`/api/pipeline/stages/${stageId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transition }),
      })
      fetchItem()
    } catch (err) { console.error('Transition failed:', err) }
  }

  const handleAddArtifact = async (stageId: number, name: string, artifactType: string, content: string) => {
    try {
      await fetch(`/api/pipeline/stages/${stageId}/artifacts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, artifactType, content }),
      })
      fetchItem()
    } catch (err) { console.error('Add artifact failed:', err) }
  }

  const handleAddReview = async (stageId: number, result: string, comment: string) => {
    try {
      await fetch(`/api/pipeline/stages/${stageId}/reviews`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, comment }),
      })
      fetchItem()
    } catch (err) { console.error('Add review failed:', err) }
  }

  const handleStageSelect = (stageIndex: number) => {
    setSelectedStageIndex(stageIndex)
    setActiveTab('detail')
  }

  const handleSelectArtifact = (artifactId: number) => {
    setSelectedArtifactId(artifactId)
    setActiveTab('detail')
  }

  const { selectedArtifact, selectedVersionLabel } = useMemo(() => {
    if (!item || selectedArtifactId === null) return { selectedArtifact: null, selectedVersionLabel: '' }
    for (const stage of item.stages) {
      const versioned = getVersionedArtifacts(stage.artifacts)
      const found = versioned.find(v => v.artifact.id === selectedArtifactId)
      if (found) return { selectedArtifact: found.artifact, selectedVersionLabel: found.versionLabel }
    }
    return { selectedArtifact: null, selectedVersionLabel: '' }
  }, [item, selectedArtifactId])

  const startAutopilot = async () => {
    abortRef.current = new AbortController()
    setAutopilot({ running: true, steps: initializeSteps(), currentStageKey: null, stoppedReason: null, completed: false, error: null })
    try {
      const response = await fetch('/api/pipeline/autopilot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }), signal: abortRef.current.signal,
      })
      if (!response.ok || !response.body) throw new Error('Failed to start autopilot')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let currentEvent = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('event: ')) { currentEvent = line.slice(7) }
          else if (line.startsWith('data: ')) {
            try { const data = JSON.parse(line.slice(6)); if (currentEvent) { handleSSEEvent(currentEvent, data); currentEvent = '' } } catch { /* skip */ }
          } else if (line.trim() === '') { currentEvent = '' }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setAutopilot(prev => ({ ...prev, running: false, error: err instanceof Error ? err.message : 'Auto pilot failed' }))
    }
  }

  const handleSSEEvent = (eventType: string, data: Record<string, unknown>) => {
    if (data.stageKey !== undefined) setAutopilot(prev => ({ ...prev, currentStageKey: data.stageKey as string }))
    switch (eventType) {
      case 'generating': setAutopilot(prev => ({ ...prev, steps: prev.steps.map(s => s.generateType === data.generateType ? { ...s, status: 'running' as const } : s) })); break
      case 'generated': setAutopilot(prev => ({ ...prev, steps: prev.steps.map(s => s.generateType === data.generateType ? { ...s, status: 'done' as const, artifactName: data.artifactName as string } : s) })); break
      case 'review_result': setAutopilot(prev => ({ ...prev, steps: prev.steps.map(s => s.generateType === data.generateType ? { ...s, reviewResult: data.result as string, risks: data.risks as Array<{ level: string; message: string }> } : s) })); break
      case 'stopped': setAutopilot(prev => ({ ...prev, running: false, stoppedReason: data.message as string })); fetchItem(); break
      case 'completed': setAutopilot(prev => ({ ...prev, running: false, completed: true })); fetchItem(); break
      case 'error': setAutopilot(prev => ({ ...prev, running: false, error: data.message as string })); fetchItem(); break
    }
  }

  const cancelAutopilot = () => { abortRef.current?.abort(); setAutopilot(prev => ({ ...prev, running: false })) }

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

  const statusLabels: Record<string, string> = { in_progress: '进行中', completed: '已完成', abandoned: '已放弃' }
  const selectedStage = selectedStageIndex !== null ? item.stages.find(s => s.stageIndex === selectedStageIndex) : null
  const canAutopilot = hasAiConfig && !autopilot.running && item.overallStatus === 'in_progress' && item.currentStageIndex <= 2

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'detail', label: '阶段详情', icon: <Layers className="w-3.5 h-3.5" /> },
    { key: 'overview', label: '全局概览', icon: <Activity className="w-3.5 h-3.5" /> },
  ]

  const showViewer = selectedArtifactId !== null && activeTab === 'detail'

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left panel */}
      <div className="w-[260px] shrink-0 border-r border-border bg-card/50 flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <Link href="/pipeline" className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft className="w-3 h-3" /> 返回列表
          </Link>
          <h1 className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">{item.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              {statusLabels[item.overallStatus] ?? item.overallStatus}
            </span>
            <span className="text-[10px] text-muted-foreground">{item.priority}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2.5 py-3">
          <PipelineStepper
            stages={item.stages}
            currentStageIndex={item.currentStageIndex}
            selectedIndex={selectedStageIndex}
            onSelect={handleStageSelect}
            onSelectArtifact={handleSelectArtifact}
          />
        </div>
        <div className="px-3 py-3 border-t border-border space-y-2">
          {canAutopilot && (
            <button onClick={startAutopilot}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary to-blue-500 text-white hover:shadow-md hover:shadow-primary/20 transition-all">
              <Zap className="w-3.5 h-3.5" /> Auto Pilot
            </button>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab bar */}
        <div className="flex items-center border-b border-border px-6 bg-card/30 shrink-0">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-all border-b-2 -mb-px',
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Top: stage info */}
          <div className={cn('overflow-y-auto', showViewer ? 'flex-none max-h-[40%]' : 'flex-1')}>
            <div className="px-8 py-6">
              <AutopilotProgress state={autopilot} onCancel={cancelAutopilot} />
              {activeTab === 'detail' && selectedStage && (
                <div className="fade-in-up">
                  <StageMessage
                    stage={selectedStage}
                    isCurrentStage={selectedStage.stageIndex === item.currentStageIndex}
                    hasAiConfig={hasAiConfig}
                    itemId={itemId}
                    selectedArtifactId={selectedArtifactId}
                    onTransition={handleTransition}
                    onAddArtifact={(id) => setArtifactStageId(id)}
                    onAddReview={(id) => setReviewStageId(id)}
                    onSaved={fetchItem}
                    onSelectArtifact={handleSelectArtifact}
                    disabled={autopilot.running}
                  />
                </div>
              )}
              {activeTab === 'detail' && !selectedStage && (
                <div className="text-center py-12 text-sm text-muted-foreground">请在左侧选择一个阶段查看详情</div>
              )}
              {activeTab === 'overview' && <ItemOverviewPanel item={item} events={events} />}
            </div>
          </div>

          {/* Bottom: artifact viewer */}
          {showViewer && (
            <div className="flex-1 min-h-0 border-t border-border bg-background">
              <ArtifactViewer
                artifact={selectedArtifact}
                versionLabel={selectedVersionLabel}
                onClose={() => setSelectedArtifactId(null)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AddArtifactDialog
        open={artifactStageId !== null}
        onOpenChange={(open) => { if (!open) setArtifactStageId(null) }}
        onSubmit={(name, type, content) => { if (artifactStageId) handleAddArtifact(artifactStageId, name, type, content) }}
      />
      <AddReviewDialog
        open={reviewStageId !== null}
        onOpenChange={(open) => { if (!open) setReviewStageId(null) }}
        onSubmit={(result, comment) => { if (reviewStageId) handleAddReview(reviewStageId, result, comment) }}
      />
    </div>
  )
}
