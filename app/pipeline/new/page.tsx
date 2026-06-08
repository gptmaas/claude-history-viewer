'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'

function NewPipelineItemForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sourceSessionId = searchParams.get('sourceSessionId')

  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([])
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [title, setTitle] = useState('')
  const [background, setBackground] = useState('')
  const [goals, setGoals] = useState<string[]>([''])
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>([''])
  const [priority, setPriority] = useState('P2')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/pipeline/projects').then(r => r.json()).then((data: Array<{ id: number; name: string }>) => {
      setProjects(data)
      if (data.length > 0) setSelectedProjectId(data[0].id)
    })
  }, [])

  const handleSubmit = async () => {
    if (!title) return
    setSubmitting(true)
    try {
      let projectId = selectedProjectId

      // Create project if needed
      if (!projectId && newProjectName) {
        const res = await fetch('/api/pipeline/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newProjectName }),
        })
        const project = await res.json()
        projectId = project.id
      }

      if (!projectId) {
        // Create a default project
        const res = await fetch('/api/pipeline/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '默认项目' }),
        })
        const project = await res.json()
        projectId = project.id
      }

      const res = await fetch('/api/pipeline/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title,
          background: background || undefined,
          goals: goals.filter(g => g.trim()) || undefined,
          acceptanceCriteria: acceptanceCriteria.filter(a => a.trim()) || undefined,
          priority,
          sourceSessionId: sourceSessionId || undefined,
        }),
      })
      const item = await res.json()
      router.push(`/pipeline/items/${item.id}`)
    } catch (err) {
      console.error('Failed to create item:', err)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/pipeline" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-semibold text-foreground">新建需求</h1>
        </div>

        {/* Project selector */}
        <div>
          <label className="text-sm font-medium text-foreground">项目</label>
          {projects.length > 0 ? (
            <select
              value={selectedProjectId ?? ''}
              onChange={(e) => setSelectedProjectId(Number(e.target.value) || null)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
            >
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="">+ 新建项目</option>
            </select>
          ) : (
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              placeholder="项目名称"
            />
          )}
          {selectedProjectId === null && projects.length > 0 && (
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full mt-2 px-3 py-2 rounded-md border border-border bg-background text-sm"
              placeholder="新项目名称"
            />
          )}
        </div>

        {/* Title */}
        <div>
          <label className="text-sm font-medium text-foreground">标题 *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
            placeholder="需求标题"
          />
        </div>

        {/* Background */}
        <div>
          <label className="text-sm font-medium text-foreground">背景</label>
          <textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm min-h-[80px]"
            placeholder="需求背景描述..."
          />
        </div>

        {/* Goals */}
        <div>
          <label className="text-sm font-medium text-foreground">目标</label>
          <div className="space-y-2 mt-1">
            {goals.map((g, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={g}
                  onChange={(e) => { const next = [...goals]; next[i] = e.target.value; setGoals(next) }}
                  className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
                  placeholder={`目标 ${i + 1}`}
                />
                {goals.length > 1 && (
                  <button
                    onClick={() => setGoals(goals.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive text-sm"
                  >✕</button>
                )}
              </div>
            ))}
            <button
              onClick={() => setGoals([...goals, ''])}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="w-3 h-3" /> 添加目标
            </button>
          </div>
        </div>

        {/* Acceptance criteria */}
        <div>
          <label className="text-sm font-medium text-foreground">验收标准</label>
          <div className="space-y-2 mt-1">
            {acceptanceCriteria.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={a}
                  onChange={(e) => { const next = [...acceptanceCriteria]; next[i] = e.target.value; setAcceptanceCriteria(next) }}
                  className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
                  placeholder={`验收标准 ${i + 1}`}
                />
                {acceptanceCriteria.length > 1 && (
                  <button
                    onClick={() => setAcceptanceCriteria(acceptanceCriteria.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive text-sm"
                  >✕</button>
                )}
              </div>
            ))}
            <button
              onClick={() => setAcceptanceCriteria([...acceptanceCriteria, ''])}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="w-3 h-3" /> 添加验收标准
            </button>
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="text-sm font-medium text-foreground">优先级</label>
          <div className="flex gap-2 mt-1">
            {['P0', 'P1', 'P2', 'P3'].map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  priority === p
                    ? p === 'P0' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                      : p === 'P1' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                      : p === 'P2' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Source session */}
        {sourceSessionId && (
          <div className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
            来源会话: {sourceSessionId}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/pipeline"
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </Link>
          <button
            onClick={handleSubmit}
            disabled={!title || submitting}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? '创建中...' : '创建需求'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NewPipelineItemPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-r-transparent rounded-full" /></div>}>
      <NewPipelineItemForm />
    </Suspense>
  )
}
