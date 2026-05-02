'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Search, BarChart3, Clock, Calendar, FolderOpen, TrendingUp, User, Bot, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProjectCard, type Project } from '@/components/project-card'
import type { DashboardStats } from '@/app/api/stats/route'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatDistanceToNow } from 'date-fns'

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Phase 1: Load projects first (fast - no stats computation)
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(data.projects)
        setProjectsLoading(false)
      })
      .catch(err => {
        console.error('Failed to load projects:', err)
        setProjectsLoading(false)
      })

    // Phase 2: Load stats in parallel (slow - full stats computation)
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => {
        setStats(data)
        setStatsLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load stats')
        setStatsLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-purple-600" />
              Claude Code Dashboard
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-slate-600 dark:text-slate-400">
                Overview of your conversation history
              </p>
              {!statsLoading && stats?.lastUpdated && (
                <>
                  <span className="text-slate-400">•</span>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    Last updated: {formatDistanceToNow(new Date(stats.lastUpdated), { addSuffix: true })}
                  </p>
                </>
              )}
            </div>
          </div>
          <nav className="flex gap-2">
            <Link
              href="/sessions"
              className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors flex items-center gap-2 text-sm"
            >
              <MessageSquare className="w-4 h-4" />
              Sessions
            </Link>
            <Link
              href="/search"
              className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors flex items-center gap-2 text-sm"
            >
              <Search className="w-4 h-4" />
              Search
            </Link>
          </nav>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Stats Cards - Show skeleton while loading, don't block projects */}
        {statsLoading ? (
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stats ? (
          <>
            {/* Summary Stats */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Last 24 Hours
                  </CardTitle>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Main: Total messages */}
                    <div className="text-center py-2">
                      <div className="text-4xl font-bold text-slate-900 dark:text-slate-50">
                        {stats.lastDayUserMessages + stats.lastDayAssistantMessages}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Messages</div>
                    </div>
                    {/* User/AI breakdown + Sessions */}
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex items-center justify-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <User className="w-4 h-4" />
                          {stats.lastDayUserMessages}
                        </span>
                        <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                          <Bot className="w-4 h-4" />
                          {stats.lastDayAssistantMessages}
                        </span>
                      </div>
                      <div className="text-center text-xs text-muted-foreground">
                        {stats.lastDayCount} sessions
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Last 7 Days
                  </CardTitle>
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="h-[140px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.dailyMessageCounts}>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Bar
                          dataKey="count"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total
                  </CardTitle>
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Main: Total messages */}
                    <div className="text-center py-2">
                      <div className="text-4xl font-bold text-slate-900 dark:text-slate-50">
                        {stats.totalUserMessages + stats.totalAssistantMessages}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Messages</div>
                    </div>
                    {/* User/AI breakdown + Sessions */}
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex items-center justify-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <User className="w-4 h-4" />
                          {stats.totalUserMessages}
                        </span>
                        <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                          <Bot className="w-4 h-4" />
                          {stats.totalAssistantMessages}
                        </span>
                      </div>
                      <div className="text-center text-xs text-muted-foreground">
                        {stats.totalSessions} sessions
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {/* Top Projects - Load independently of stats */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Top 10 Active Projects
          </h2>
          {projectsLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="animate-pulse h-48" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No projects found
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projects.slice(0, 10).map((project) => (
                <ProjectCard key={project.project} stats={project} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
