'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { PipelineSessionLinkType } from '@/lib/pipeline-types'

const linkTypeOptions: { value: PipelineSessionLinkType; label: string }[] = [
  { value: 'requirement_source', label: '需求来源' },
  { value: 'product_discussion', label: '产品讨论' },
  { value: 'technical_discussion', label: '技术讨论' },
  { value: 'implementation_log', label: '实现记录' },
  { value: 'test_evidence', label: '测试证据' },
  { value: 'acceptance_evidence', label: '验收证据' },
]

interface LinkSessionDialogProps {
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onLinked?: () => void
}

export function LinkSessionDialog({ sessionId, open, onOpenChange, onLinked }: LinkSessionDialogProps) {
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([])
  const [items, setItems] = useState<Array<{ id: number; title: string }>>([])
  const [stages, setStages] = useState<Array<{ id: number; stageKey: string }>>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [itemId, setItemId] = useState<number | null>(null)
  const [stageId, setStageId] = useState<number | null>(null)
  const [linkType, setLinkType] = useState<PipelineSessionLinkType>('requirement_source')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      fetch('/api/pipeline/projects').then(r => r.json()).then(setProjects)
    }
  }, [open])

  useEffect(() => {
    if (projectId) {
      fetch(`/api/pipeline/items?projectId=${projectId}`).then(r => r.json()).then(setItems)
      setItemId(null)
      setStages([])
    }
  }, [projectId])

  useEffect(() => {
    if (itemId) {
      fetch(`/api/pipeline/stages/${itemId}`).then(r => r.json()).then(setStages)
    }
  }, [itemId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">关联到流水线</h3>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">项目</label>
            <select
              value={projectId ?? ''}
              onChange={(e) => setProjectId(Number(e.target.value) || null)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
            >
              <option value="">选择项目...</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {projectId && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">需求</label>
              <select
                value={itemId ?? ''}
                onChange={(e) => setItemId(Number(e.target.value) || null)}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              >
                <option value="">选择需求...</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
              </select>
            </div>
          )}
          {itemId && stages.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">阶段（可选）</label>
              <select
                value={stageId ?? ''}
                onChange={(e) => setStageId(Number(e.target.value) || null)}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              >
                <option value="">不指定阶段</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.stageKey}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">关联类型</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {linkTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLinkType(opt.value)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    linkType === opt.value
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">备注</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              placeholder="可选备注..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={() => onOpenChange(false)} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
            取消
          </button>
          <button
            onClick={async () => {
              if (!itemId) return
              await fetch('/api/pipeline/session-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, stageId, sessionId, linkType, note }),
              })
              onLinked?.()
              onOpenChange(false)
              setNote('')
            }}
            disabled={!itemId}
            className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            关联
          </button>
        </div>
      </div>
    </div>
  )
}
