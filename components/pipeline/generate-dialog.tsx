'use client'

import { useState } from 'react'
import { X, Sparkles, Loader2, RefreshCw, Save } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { GenerateType } from '@/lib/ai/prompts'

const GENERATE_LABELS: Record<GenerateType, string> = {
  requirement: 'AI 补全需求',
  product_design: '生成产品方案',
  product_review: '生成产品评审',
  technical_design: '生成技术方案',
  tech_review: '生成技术评审',
  task_breakdown: '生成任务拆分',
  test_plan: '生成测试计划',
}

interface GenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: number
  stageKey: string
  generateType: GenerateType
  onSaved: () => void
}

interface GenerateResult {
  content: string
  artifactName: string
  artifactType: string
  isReview: boolean
  reviewResult?: string
}

export function GenerateDialog({
  open, onOpenChange, itemId, stageKey, generateType, onSaved,
}: GenerateDialogProps) {
  const [state, setState] = useState<'idle' | 'generating' | 'preview'>('idle')
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [manualNotes, setManualNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleGenerate = async () => {
    setState('generating')
    setError(null)
    try {
      const res = await fetch('/api/pipeline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          stageKey,
          generateType,
          context: { manualNotes: manualNotes || undefined },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Generation failed')
      }
      const data: GenerateResult = await res.json()
      setResult(data)
      setEditedContent(data.content)
      setState('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setState('idle')
    }
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      const itemRes = await fetch(`/api/pipeline/items/${itemId}`)
      const item = await itemRes.json()
      const stage = item.stages?.find((s: { stageKey: string }) => s.stageKey === stageKey)
      if (!stage) throw new Error('Stage not found')

      await fetch(`/api/pipeline/stages/${stage.id}/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: result.artifactName,
          artifactType: result.artifactType,
          content: editedContent,
        }),
      })

      if (result.isReview && result.reviewResult) {
        await fetch(`/api/pipeline/stages/${stage.id}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            result: result.reviewResult,
            comment: editedContent,
            reviewerType: 'auto',
          }),
        })
      }

      onSaved()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setState('idle')
    setResult(null)
    setEditedContent('')
    setManualNotes('')
    setError(null)
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">{GENERATE_LABELS[generateType]}</h3>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {state === 'idle' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">补充说明（可选）</label>
                <textarea
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm min-h-[80px]"
                  placeholder="可以输入额外的上下文信息，帮助 AI 更好地生成内容..."
                />
              </div>
              <button
                onClick={handleGenerate}
                className="w-full px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> 开始生成
              </button>
            </div>
          )}

          {state === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">正在生成...</p>
              <p className="text-xs text-muted-foreground">这可能需要 10-30 秒</p>
            </div>
          )}

          {state === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {result?.artifactName} ({result?.artifactType})
                </span>
                <button
                  onClick={handleGenerate}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> 重新生成
                </button>
              </div>
              <details>
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground mb-2">
                  编辑内容（点击展开）
                </summary>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm min-h-[300px] font-mono"
                />
              </details>
              <div className="prose prose-sm dark:prose-invert max-w-none p-3 bg-muted/30 rounded-lg overflow-auto max-h-[400px]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {editedContent}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {state === 'preview' && (
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-border shrink-0">
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? '保存中...' : '保存为产物'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
