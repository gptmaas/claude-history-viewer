'use client'

import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Clock, TrendingUp, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export interface Project {
  project: string
  projectName: string
  totalSessions: number
  lastUpdate: number
  recentSessions?: number
}

interface ProjectCardProps {
  stats: Project
}

export function ProjectCard({ stats }: ProjectCardProps) {
  const timeSinceUpdate = formatDistanceToNow(new Date(stats.lastUpdate), {
    addSuffix: true,
  })

  return (
    <Link href={`/projects?project=${encodeURIComponent(stats.project)}`}>
      <Card className="group cursor-pointer transition-all hover:border-primary/30 h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium truncate flex items-center justify-between">
            <span className="truncate" title={stats.projectName}>
              {stats.projectName}
            </span>
            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2 text-primary" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total sessions</span>
            <span className="font-semibold text-sm text-foreground tabular-nums">{stats.totalSessions}</span>
          </div>

          {stats.recentSessions !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Last 24h
              </span>
              <span className={`text-xs font-semibold ${stats.recentSessions > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {stats.recentSessions}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-2 border-t border-border">
            <Clock className="w-3 h-3" />
            <span>Updated {timeSinceUpdate}</span>
          </div>

          {stats.recentSessions !== undefined && stats.recentSessions > 0 && (
            <div className="flex gap-1 pt-1">
              {Array.from({ length: Math.min(stats.recentSessions, 5) }).map((_, i) => (
                <div key={i} className="h-1 w-1 rounded-full bg-emerald-500" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
