'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  FolderOpen,
  Clock,
  ArrowLeft,
  User,
  Bot,
  Zap,
  FileText,
  Eye,
  Code,
  Download,
  MessageSquare,
  TrendingUp,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { JsonViewer } from '@/components/json-viewer'
import { ToolUseViewer, ThinkingViewer, ToolResultViewer } from '@/components/tool-viewer'
import { ContentArrayRenderer } from '@/components/content-array-renderer'
import { UserMessageRenderer } from '@/components/user-message-renderer'
import { formatDistanceToNow } from 'date-fns'
import type { Message } from '@/lib/types'
import type { Project } from '@/components/project-card'

interface Session {
  sessionId: string
  display: string
  project: string
  projectName: string
  timestamp: number
  date: string
  messageCount?: number
}

/* ---------- Project List View ---------- */

function ProjectListView({ onSelect }: { onSelect: (project: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => setProjects(data.projects ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-[1400px] mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            项目
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {projects.length} projects total
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl bg-card border border-border p-12 text-center">
            <FolderOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No projects found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {projects.map((project) => (
              <button
                key={project.project}
                onClick={() => onSelect(project.project)}
                className="text-left rounded-xl bg-card border border-border p-4 hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                  <h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {project.projectName}
                  </h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Sessions</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {project.totalSessions}
                    </span>
                  </div>
                  {project.recentSessions !== undefined && project.recentSessions > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Last 24h
                      </span>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {project.recentSessions}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border">
                  <Clock className="w-3 h-3" />
                  Updated {formatDistanceToNow(new Date(project.lastUpdate), { addSuffix: true })}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Content Rendering ---------- */

function getContentTypeInfo(content: string | unknown): { type: string | null; name: string | null } {
  let parsed: unknown = content
  if (typeof content === 'string') {
    try {
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) parsed = JSON.parse(content)
      else return { type: null, name: null }
    } catch { return { type: null, name: null } }
  }
  if (Array.isArray(parsed) && parsed.length > 0) {
    const f = parsed[0]
    if (typeof f === 'object' && f !== null && 'type' in f) return { type: (f as Record<string, unknown>).type as string, name: ((f as Record<string, unknown>).name as string) || null }
  }
  if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
    return { type: (parsed as Record<string, unknown>).type as string, name: ((parsed as Record<string, unknown>).name as string) || null }
  }
  return { type: null, name: null }
}

function renderContent(content: string | unknown): React.ReactNode {
  if (typeof content === 'string') {
    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      try {
        const p = JSON.parse(content)
        if (p.type === 'tool_use' || p.type === 'server_tool_use') return <ToolUseViewer content={content} data={p} />
        return <JsonViewer content={content} data={p} />
      } catch { return <MarkdownRenderer content={content} /> }
    }
    return <MarkdownRenderer content={content} />
  }
  if (Array.isArray(content)) return <ContentArrayRenderer content={content} />
  if (typeof content === 'object' && content !== null) {
    if ('type' in content && content.type === 'thinking') return <ThinkingViewer content={content} />
    try { return <JsonViewer content={JSON.stringify(content, null, 2)} data={content} /> } catch { return <pre className="text-xs bg-muted p-2 rounded">{String(content)}</pre> }
  }
  return String(content ?? '')
}

function formatDateTime(timestamp: number | string): string {
  const d = new Date(typeof timestamp === 'string' ? timestamp : timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/* ---------- Single Message ---------- */

function MessageItem({ msg, isRaw, onToggleRaw }: { msg: Message; isRaw: boolean; onToggleRaw: () => void }) {
  if (msg.type === 'user') {
    return (
      <div className="flex gap-3 mb-5">
        <div className="shrink-0 w-7 h-7 rounded-full bg-emerald-500/10 dark:bg-emerald-500/10 flex items-center justify-center mt-0.5">
          <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">You</span>
            {msg.timestamp && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />{formatDateTime(msg.timestamp)}
              </span>
            )}
            <button onClick={onToggleRaw} className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground transition-colors" title={isRaw ? 'Show rendered' : 'Show raw'}>
              {isRaw ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
            </button>
          </div>
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3">
            <UserMessageRenderer content={msg.content} isRaw={isRaw} />
          </div>
        </div>
      </div>
    )
  }

  if (msg.type === 'assistant') {
    const info = getContentTypeInfo(msg.content)
    return (
      <div className="flex gap-3 mb-5">
        <div className="shrink-0 w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center mt-0.5">
          <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {info.type === 'tool_use' && info.name && (
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />{info.name}</span>
            )}
            {msg.timestamp && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{formatDateTime(msg.timestamp)}</span>}
            <button onClick={onToggleRaw} className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground transition-colors" title={isRaw ? 'Show rendered' : 'Show raw'}>
              {isRaw ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
            </button>
          </div>
          {isRaw ? (
            <pre className="bg-muted border border-border p-3 rounded-lg text-xs whitespace-pre max-w-full overflow-x-auto">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}</pre>
          ) : renderContent(msg.content)}
        </div>
      </div>
    )
  }

  if (msg.type === 'tool_use') {
    const info = getContentTypeInfo(msg.content)
    return (
      <div className="flex gap-3 mb-5">
        <div className="shrink-0 w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center mt-0.5">
          <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {info.type === 'tool_use' && info.name && <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />{info.name}</span>}
            {msg.timestamp && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{formatDateTime(msg.timestamp)}</span>}
            <button onClick={onToggleRaw} className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
              {isRaw ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
            </button>
          </div>
          {isRaw ? (
            <pre className="bg-muted border border-border p-3 rounded-lg text-xs whitespace-pre max-w-full overflow-x-auto">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}</pre>
          ) : renderContent(msg.content)}
        </div>
      </div>
    )
  }

  if (msg.type === 'tool_result') {
    const info = getContentTypeInfo(msg.content)
    return (
      <div className="flex gap-3 mb-5">
        <div className="shrink-0 w-7 h-7 rounded-full bg-teal-500/10 flex items-center justify-center mt-0.5">
          <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">{info.type || msg.type}</span>
            {msg.timestamp && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{formatDateTime(msg.timestamp)}</span>}
            <button onClick={onToggleRaw} className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
              {isRaw ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
            </button>
          </div>
          <div className="rounded-lg bg-teal-500/5 border border-teal-500/10 p-3">
            {isRaw ? (
              <pre className="bg-muted p-3 rounded text-xs whitespace-pre max-w-full overflow-x-auto">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}</pre>
            ) : renderContent(msg.content)}
          </div>
        </div>
      </div>
    )
  }

  return null
}

/* ---------- Split Panel Detail View ---------- */

function ProjectDetailView({ project, onBack }: { project: string; onBack: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSession = searchParams.get('s') || null

  const [sessions, setSessions] = useState<Session[]>([])
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sessionsLoading, setSessionsLoading] = useState(true)

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(initialSession)
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionDisplay, setSessionDisplay] = useState<string>('')
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [rawMessage, setRawMessage] = useState<string | null>(null)

  useEffect(() => {
    setSessionsLoading(true)
    fetch(`/api/sessions?pageSize=200&project=${encodeURIComponent(project)}`)
      .then((r) => r.json())
      .then((data) => {
        setSessions(data.sessions)
        setFilteredSessions(data.sessions)
        if (!selectedSessionId && data.sessions?.length > 0) {
          handleSelectSession(data.sessions[0].sessionId)
        }
      })
      .catch(console.error)
      .finally(() => setSessionsLoading(false))
  }, [project]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredSessions(sessions); return }
    const q = searchQuery.toLowerCase()
    setFilteredSessions(sessions.filter((s) => s.display.toLowerCase().includes(q) || s.projectName.toLowerCase().includes(q)))
  }, [sessions, searchQuery])

  const handleSelectSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId)
    setMessagesLoading(true)
    setRawMessage(null)
    const params = new URLSearchParams(searchParams.toString())
    params.set('s', sessionId)
    router.replace(`/projects?project=${encodeURIComponent(project)}&${params.toString()}`, { scroll: false })
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((data) => { setMessages(data.messages || []); setSessionDisplay(data.session?.display || '') })
      .catch(console.error)
      .finally(() => setMessagesLoading(false))
  }, [project, router, searchParams])

  const projectName = project.split('/').pop() || project

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel: Sessions */}
      <div className="w-[320px] shrink-0 border-r border-border flex flex-col bg-[hsl(var(--sidebar-bg))]">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={onBack} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate">{projectName}</h2>
              <p className="text-[11px] text-muted-foreground">{sessions.length} sessions</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input type="search" placeholder="Search sessions..." className="pl-8 h-8 text-xs bg-secondary border-border focus:border-primary/50" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessionsLoading ? (
            <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => (<div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />))}</div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No sessions found</p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {filteredSessions.map((session) => {
                const isSelected = session.sessionId === selectedSessionId
                return (
                  <button key={session.sessionId} onClick={() => handleSelectSession(session.sessionId)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                      isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-secondary border border-transparent'
                    }`}
                  >
                    <p className={`text-xs font-medium truncate mb-1 ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {session.display || 'Untitled'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{formatDistanceToNow(new Date(session.date), { addSuffix: true })}</span>
                      {session.messageCount && <span>{session.messageCount} msgs</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Messages */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSessionId ? (
          <>
            <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-foreground truncate">{sessionDisplay || 'Loading...'}</h3>
                <p className="text-[11px] text-muted-foreground">{projectName} · {messages.length} messages</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => window.open(`/api/sessions/${selectedSessionId}/export?format=md`, '_blank')} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                  <Download className="w-3 h-3 mr-1" />Export
                </Button>
                <Link href={`/sessions/${selectedSessionId}`}>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">Full View</Button>
                </Link>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-20"><p className="text-sm text-muted-foreground">No messages in this session</p></div>
              ) : (
                <div className="max-w-3xl mx-auto">
                  {messages.map((msg) => (
                    <MessageItem key={msg.uuid || Math.random().toString()} msg={msg} isRaw={rawMessage === msg.uuid} onToggleRaw={() => setRawMessage(rawMessage === msg.uuid ? null : msg.uuid || null)} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select a session to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Main Page ---------- */

function ProjectsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectParam = searchParams.get('project')

  if (projectParam) {
    return <ProjectDetailView project={decodeURIComponent(projectParam)} onBack={() => router.push('/projects')} />
  }

  return <ProjectListView onSelect={(project) => router.push(`/projects?project=${encodeURIComponent(project)}`)} />
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent" />
      </div>
    }>
      <ProjectsContent />
    </Suspense>
  )
}
