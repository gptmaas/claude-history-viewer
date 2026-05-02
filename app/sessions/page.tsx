'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { Search, Filter, MessageSquare, FolderOpen, Clock, ArrowLeft, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Session {
  sessionId: string
  display: string
  project: string
  projectName: string
  timestamp: number
  date: string // ISO string from API
  messageCount?: number
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

  useEffect(() => {
    loadSessions()
  }, [])

  // Set selectedProject from URL on mount and when sessions load
  useEffect(() => {
    const projectParam = searchParams.get('project')
    if (projectParam && projects.length > 0) {
      setSelectedProject(projectParam)
    }
  }, [searchParams, projects])

  useEffect(() => {
    filterSessions()
  }, [sessions, searchQuery, selectedProject])

  async function loadSessions() {
    try {
      const response = await fetch('/api/sessions')
      const data = await response.json()
      setSessions(data.sessions)
      setFilteredSessions(data.sessions)

      // Extract unique projects
      const uniqueProjects = Array.from(new Set(data.sessions.map((s: Session) => s.project)))
      setProjects(uniqueProjects as string[])
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  function filterSessions() {
    let filtered = [...sessions]

    // Filter by project
    if (selectedProject !== 'all') {
      filtered = filtered.filter((s) => s.project === selectedProject)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((s) =>
        s.display.toLowerCase().includes(query) ||
        s.projectName.toLowerCase().includes(query)
      )
    }

    setFilteredSessions(filtered)
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }).catch((err) => {
      console.error('Failed to copy:', err)
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                Conversation History
              </h1>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {filteredSessions.length} of {sessions.length} sessions
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2 sm:w-64">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="all">All Projects</option>
                {projects.map((project) => (
                  <option key={project} value={project}>
                    {project.split('/').pop() || project}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Search conversations..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading sessions...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-2">
              No sessions found
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              {searchQuery || selectedProject !== 'all'
                ? 'Try adjusting your filters'
                : 'Start a conversation with Claude Code to see it here'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSessions.map((session) => (
              <Link key={session.sessionId} href={`/sessions/${session.sessionId}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg line-clamp-2">
                      {session.display || 'Untitled Conversation'}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <FolderOpen className="h-3 w-3" />
                      {session.projectName}
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-mono">
                        {session.sessionId}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          copyToClipboard(session.sessionId, session.sessionId)
                        }}
                        title={copiedId === session.sessionId ? 'Copied!' : 'Copy session ID'}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(session.date), { addSuffix: true })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// Wrapper component with Suspense boundary for useSearchParams
export default function WrappedSessionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading sessions...</p>
        </div>
      </div>
    }>
      <SessionsPage />
    </Suspense>
  )
}
