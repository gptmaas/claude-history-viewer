'use client'

import { X, FileText, ListChecks, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PipelineArtifact } from '@/lib/pipeline-data'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ArtifactViewerProps {
  artifact: PipelineArtifact | null
  versionLabel?: string
  onClose: () => void
}

export function ArtifactViewer({ artifact, versionLabel, onClose }: ArtifactViewerProps) {
  if (!artifact) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground/40">
        <div className="text-center space-y-2">
          <FileText className="w-8 h-8 mx-auto opacity-30" />
          <p className="text-xs">点击产物查看内容</p>
        </div>
      </div>
    )
  }

  const isTaskJson = artifact.name.includes('任务拆分') || artifact.artifactType === 'json'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card/50 shrink-0">
        <FileText className="w-4 h-4 text-primary/70 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {artifact.name}{versionLabel ? ` ${versionLabel}` : ''}
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
            <span>{artifact.artifactType}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {new Date(artifact.createdAt).toLocaleString('zh-CN')}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {artifact.content ? (
          isTaskJson ? (
            <TaskTable content={artifact.content} />
          ) : (
            <div className="prose prose-base dark:prose-invert max-w-none leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {artifact.content}
              </ReactMarkdown>
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">此产物无内容</p>
        )}
      </div>
    </div>
  )
}

// --- Task table rendering ---

interface Task {
  title?: string
  description?: string
  complexity?: string
  dependencies?: string[] | string
  risk?: string
  [key: string]: unknown
}

function TaskTable({ content }: { content: string }) {
  let tasks: Task[] = []

  try {
    tasks = JSON.parse(content)
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
    if (jsonMatch) {
      try { tasks = JSON.parse(jsonMatch[1]) } catch { /* fall through */ }
    }
    if (!tasks.length) {
      const arrMatch = content.match(/\[[\s\S]*\]/)
      if (arrMatch) {
        try { tasks = JSON.parse(arrMatch[0]) } catch { /* fall through */ }
      }
    }
  }

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return (
      <div className="prose prose-base dark:prose-invert max-w-none leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    )
  }

  const cols = ['title', 'description', 'complexity', 'risk'] as const
  const colLabels: Record<string, string> = {
    title: '任务', description: '描述', complexity: '复杂度', dependencies: '依赖', risk: '风险',
  }
  const activeCols = cols.filter(col => tasks.some(t => t[col] !== undefined && t[col] !== null && t[col] !== ''))

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ListChecks className="w-4 h-4 text-primary/70" />
        <span className="text-xs font-semibold text-foreground">{tasks.length} 个任务</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-muted/40 border-b border-border/60">
              <th className="px-3 py-2 text-[11px] font-semibold text-muted-foreground w-8">#</th>
              {activeCols.map(col => (
                <th key={col} className="px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                  {colLabels[col] ?? col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, i) => (
              <tr key={i} className={cn('border-b border-border/30 last:border-0', i % 2 === 1 && 'bg-muted/15')}>
                <td className="px-3 py-2.5 text-[11px] text-muted-foreground font-medium">{i + 1}</td>
                {activeCols.map(col => (
                  <td key={col} className={cn(
                    'px-3 py-2.5 text-xs',
                    col === 'title' && 'font-medium text-foreground',
                    col === 'description' && 'text-foreground/70 max-w-xs',
                  )}>
                    {col === 'complexity' && task[col] ? (
                      <Badge value={String(task[col])} />
                    ) : col === 'risk' && task[col] ? (
                      <Badge value={String(task[col])} />
                    ) : (
                      <span className={col === 'description' ? 'line-clamp-2' : ''}>
                        {formatCell(task[col])}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function Badge({ value }: { value: string }) {
  const lower = value.toLowerCase()
  const color = lower.includes('high') || lower.includes('高') || lower.includes('p0')
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : lower.includes('medium') || lower.includes('中') || lower.includes('p1')
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'

  return (
    <span className={cn('inline-block px-2 py-0.5 rounded text-[10px] font-medium', color)}>
      {value}
    </span>
  )
}

// --- Versioning utilities ---

export interface VersionedArtifact {
  artifact: PipelineArtifact
  versionLabel: string
  sortKey: number
}

const NAME_SORT_ORDER: Array<{ pattern: RegExp; order: number }> = [
  { pattern: /需求/, order: 0 },
  { pattern: /方案|设计/, order: 1 },
  { pattern: /拆分/, order: 2 },
  { pattern: /计划/, order: 3 },
  { pattern: /评审/, order: 4 },
]

function getSortKey(name: string): number {
  for (const { pattern, order } of NAME_SORT_ORDER) {
    if (pattern.test(name)) return order
  }
  return 5
}

export function getVersionedArtifacts(artifacts: PipelineArtifact[]): VersionedArtifact[] {
  // Group by name
  const groups = new Map<string, PipelineArtifact[]>()
  for (const a of artifacts) {
    const existing = groups.get(a.name) ?? []
    existing.push(a)
    groups.set(a.name, existing)
  }

  const result: VersionedArtifact[] = []

  for (const [, group] of groups) {
    // Sort within group by creation time
    group.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const hasMultiple = group.length > 1
    for (let i = 0; i < group.length; i++) {
      result.push({
        artifact: group[i],
        versionLabel: hasMultiple ? `v${i + 1}` : '',
        sortKey: getSortKey(group[i].name),
      })
    }
  }

  // Sort: first by sort key (artifact type), then by creation time within same sort key
  result.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
    return new Date(a.artifact.createdAt).getTime() - new Date(b.artifact.createdAt).getTime()
  })

  return result
}
