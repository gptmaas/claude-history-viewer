'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Search, Filter, MessageSquare, FolderOpen, Clock, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Machine } from '@/lib/types'

interface Session {
  sessionId: string
  display: string
  project: string
  projectName: string
  timestamp: number
  date: string
  messageCount?: number
  machineId?: string | null
  machineName?: string | null
}

function SessionsPage() {
  const searchParams = useSearchParams()
  const [sessions, setSessions] = useState<Session[]>([])
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [projects, setProjects] = useState<string[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [selectedMachine, setSelectedMachine] = useState<string>('all')

  useEffect(() => { loadSessions() }, [])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DATA_SOURCE_MODE === 'cloud') {
      fetch('/api/machines')
        .then((r) => r.json())
        .then((data) => setMachines(data.machines ?? []))
        .catch(console.error)
    }
  }, [])

  useEffect(() => {
    const projectParam = searchParams.get('project')
    if (projectParam && projects.length > 0) setSelectedProject(projectParam)
  }, [searchParams, projects])

  useEffect(() => { filterSessions() }, [sessions, searchQuery, selectedProject, selectedMachine]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSessions() {
    try {
      const response = await fetch('/api/sessions')
      const data = await response.json()
      setSessions(data.sessions)
      setFilteredSessions(data.sessions)
      setProjects(Array.from(new Set(data.sessions.map((s: Session) => s.project))) as string[])
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  function filterSessions() {
    let filtered = [...sessions]
    if (selectedProject !== 'all') filtered = filtered.filter((s) => s.project === selectedProject)
    if (selectedMachine !== 'all') filtered = filtered.filter((s) => s.machineId === selectedMachine)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter((s) => s.display.toLowerCase().includes(q) || s.projectName.toLowerCase().includes(q))
    }
    setFilteredSessions(filtered)
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000) }).catch(console.error)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">会话</h1>
            <p className="text-sm text-muted-foreground mt-1">{filteredSessions.length} of {sessions.length} sessions</p>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <div className="flex items-center gap-2 w-56">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select className="h-9 flex-1 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground focus:border-primary/50 focus:outline-none" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
              <option value="all">All Projects</option>
              {projects.map((project) => (<option key={project} value={project}>{project.split('/').pop() || project}</option>))}
            </select>
          </div>
          {machines.length > 0 && (
            <div className="flex items-center gap-2 w-56">
              <select className="h-9 flex-1 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground focus:border-primary/50 focus:outline-none" value={selectedMachine} onChange={(e) => setSelectedMachine(e.target.value)}>
                <option value="all">All Machines</option>
                {machines.map((m) => (<option key={m.machineId} value={m.machineId}>{m.machineName} ({m.sessionCount})</option>))}
              </select>
            </div>
          )}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input type="search" placeholder="Search conversations..." className="pl-9 h-9 text-xs bg-card border-border focus:border-primary/50" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent" /></div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/20 mb-3" />
              <h2 className="text-sm font-medium text-foreground mb-1">No sessions found</h2>
              <p className="text-xs text-muted-foreground">{searchQuery || selectedProject !== 'all' || selectedMachine !== 'all' ? 'Try adjusting your filters' : 'Start a conversation with Claude Code to see it here'}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredSessions.map((session) => (
              <Link key={session.sessionId} href={`/sessions/${session.sessionId}`}>
                <Card className="h-full hover:border-primary/30 transition-all cursor-pointer">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium line-clamp-2 text-foreground">{session.display || 'Untitled Conversation'}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 text-[11px]">
                      <FolderOpen className="h-3 w-3" />{session.projectName}
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-1.5">
                      <code className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">{session.sessionId.slice(0, 8)}...</code>
                      <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => { e.preventDefault(); e.stopPropagation(); copyToClipboard(session.sessionId, session.sessionId) }} title={copiedId === session.sessionId ? 'Copied!' : 'Copy session ID'}>
                        <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />{formatDistanceToNow(new Date(session.date), { addSuffix: true })}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function WrappedSessionsPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent" /></div>}>
      <SessionsPage />
    </Suspense>
  )
}
