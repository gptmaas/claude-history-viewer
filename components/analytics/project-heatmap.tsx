'use client'

import type { ProjectHeatmapPoint } from '@/lib/types'

interface Props {
  data: ProjectHeatmapPoint[]
}

export function ProjectHeatmap({ data }: Props) {
  // Group by project
  const projectMap = new Map<string, Map<string, number>>()
  for (const item of data) {
    if (!projectMap.has(item.project)) {
      projectMap.set(item.project, new Map())
    }
    const dayMap = projectMap.get(item.project)!
    dayMap.set(item.date, (dayMap.get(item.date) || 0) + item.messageCount)
  }

  // Get all unique dates
  const allDates = new Set<string>()
  for (const dayMap of projectMap.values()) {
    for (const date of dayMap.keys()) {
      allDates.add(date)
    }
  }
  const sortedDates = Array.from(allDates).sort()

  // Get top 10 projects by total messages
  const projectTotals = new Map<string, number>()
  for (const [project, dayMap] of projectMap) {
    let total = 0
    for (const count of dayMap.values()) {
      total += count
    }
    projectTotals.set(project, total)
  }
  const topProjects = Array.from(projectTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([p]) => p)

  const maxCount = Math.max(...Array.from(projectMap.values()).map(dm => Math.max(...Array.from(dm.values()), 1)), 1)

  if (sortedDates.length === 0) {
    return <div className="text-sm text-muted-foreground">暂无数据</div>
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Date headers */}
        <div className="flex mb-1 pl-[150px]">
          {sortedDates.slice(-14).map((date) => (
            <div key={date} className="w-6 text-[8px] text-muted-foreground text-center">
              {date.slice(5)}
            </div>
          ))}
        </div>
        {/* Project rows */}
        {topProjects.map((project) => {
          const dayMap = projectMap.get(project)!
          const projectName = project.split('/').pop() || project
          return (
            <div key={project} className="flex items-center mb-1">
              <div className="w-[150px] text-xs truncate pr-2" title={project}>
                {projectName}
              </div>
              <div className="flex gap-0.5">
                {sortedDates.slice(-14).map((date) => {
                  const count = dayMap.get(date) || 0
                  const intensity = count / maxCount
                  return (
                    <div
                      key={date}
                      className="w-6 h-4 rounded-sm relative group cursor-default"
                      style={{
                        backgroundColor: count === 0 ? 'hsl(var(--muted))' : `hsl(217, 91%, ${82 - intensity * 55}%)`,
                      }}
                      title={`${projectName} @ ${date}: ${count} 条消息`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                        {projectName} @ {date}: {count} 条消息
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
