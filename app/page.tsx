'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Clock, Calendar, User, Bot, RefreshCw, TrendingUp, Zap } from 'lucide-react'
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
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects ?? [])
        setProjectsLoading(false)
      })
      .catch(() => {
        setProjectsLoading(false)
      })

    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        setStats(data)
        setStatsLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load stats')
        setStatsLoading(false)
      })
  }, [])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-[1400px] mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              概览
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">
                AI Coding 会话同步与分析平台
              </p>
              {!statsLoading && stats?.lastUpdated && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    {formatDistanceToNow(new Date(stats.lastUpdated), { addSuffix: true })}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        {statsLoading ? (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl bg-card border border-border p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-20 mb-4" />
                <div className="h-10 bg-muted rounded w-16 mx-auto" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* Last 24 Hours */}
            <div className="rounded-xl bg-card border border-border p-5 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last 24 Hours
                </span>
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="text-center py-1">
                <div className="text-3xl font-bold text-foreground tabular-nums">
                  {stats.lastDayUserMessages + stats.lastDayAssistantMessages}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Messages</div>
              </div>
              <div className="border-t border-border mt-4 pt-3 flex items-center justify-center gap-5">
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <User className="w-3 h-3" />
                  {stats.lastDayUserMessages}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
                  <Bot className="w-3 h-3" />
                  {stats.lastDayAssistantMessages}
                </span>
              </div>
              <div className="text-center text-[11px] text-muted-foreground mt-2">
                {stats.lastDayCount} sessions
              </div>
            </div>

            {/* Last 7 Days */}
            <div className="rounded-xl bg-card border border-border p-5 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last 7 Days
                </span>
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="h-[130px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(stats.dailyMessageCounts ?? []).slice(-7)}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      stroke="none"
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      stroke="none"
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'hsl(var(--foreground))',
                      }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                    />
                    <Bar
                      dataKey="count"
                      fill="hsl(var(--primary) / 0.7)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Total */}
            <div className="rounded-xl bg-card border border-border p-5 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total
                </span>
                <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="text-center py-1">
                <div className="text-3xl font-bold text-foreground tabular-nums">
                  {stats.totalUserMessages + stats.totalAssistantMessages}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Messages</div>
              </div>
              <div className="border-t border-border mt-4 pt-3 flex items-center justify-center gap-5">
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <User className="w-3 h-3" />
                  {stats.totalUserMessages}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
                  <Bot className="w-3 h-3" />
                  {stats.totalAssistantMessages}
                </span>
              </div>
              <div className="text-center text-[11px] text-muted-foreground mt-2">
                {stats.totalSessions} sessions
              </div>
            </div>
          </div>
        ) : null}

        {/* Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Top 10 Active Projects
            </h2>
            <div className="text-xs text-muted-foreground">
              {projects.length} projects total
            </div>
          </div>
          {projectsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-36 rounded-xl bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl bg-card border border-border p-12 text-center">
              <Zap className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No projects found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
