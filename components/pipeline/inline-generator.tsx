'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, Loader2, RefreshCw, Save, X, Pencil } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { GenerateType } from '@/lib/ai/prompts'
import { GENERATE_LABELS } from '@/lib/ai/prompts'

interface InlineGeneratorProps {
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

export function InlineGenerator({ itemId, stageKey, generateType, onSaved }: InlineGeneratorProps) {
  const [state, setState] = useState<'generating' | 'preview' | 'editing'>('generating')
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [editedContent, setEditedContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(false)

  const handleGenerate = async () => {
    setState('generating')
    setError(null)
    try {
      const res = await fetch('/api/pipeline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, stageKey, generateType }),
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
      setState('editing')
    }
  }

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      handleGenerate()
    }
  })

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
    setResult(null)
    setEditedContent('')
    setError(null)
    onSaved()
  }

  return (
    <div className="fade-in-up mt-3 border border-primary/20 rounded-lg bg-primary/[0.03] dark:bg-primary/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-primary/[0.06] dark:bg-primary/[0.1] border-b border-primary/10">
        <div className="flex items-center gap-2 text-xs font-medium text-primary">
          <Sparkles className="w-3.5 h-3.5" />
          {GENERATE_LABELS[generateType]}
        </div>
        <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3">
        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Generating state */}
        {state === 'generating' && (
          <div className="flex flex-col items-center py-6 gap-2">
            <div className="typing-indicator">
              <span /><span /><span />
            </div>
            <p className="text-xs text-muted-foreground">AI 正在生成内容...</p>
            <p className="text-[10px] text-muted-foreground/60">预计 10-30 秒</p>
          </div>
        )}

        {/* Preview/editing state */}
        {(state === 'preview' || state === 'editing') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{result?.artifactName} · {result?.artifactType}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setState(state === 'editing' ? 'preview' : 'editing')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  {state === 'editing' ? '预览' : '编辑'}
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> 重新生成
                </button>
              </div>
            </div>

            {state === 'editing' ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm min-h-[300px] font-mono focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            ) : (
              <div className="prose prose-base dark:prose-invert max-w-none p-4 bg-background/50 rounded-md overflow-auto max-h-[500px] stream-content leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {editedContent}
                </ReactMarkdown>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={handleClose}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1 transition-colors"
              >
                <Save className="w-3 h-3" /> {saving ? '保存中...' : '保存为产物'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
