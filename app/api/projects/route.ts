import { NextResponse } from 'next/server'
import { loadSessionsList } from '@/lib/claude-history'

export const dynamic = 'force-dynamic'

export interface Project {
  project: string
  projectName: string
  totalSessions: number
  lastUpdate: number
}

export interface ProjectsResponse {
  projects: Project[]
}

export async function GET() {
  try {
    const sessions = await loadSessionsList()

    // Group by project (no stats computation - lightweight)
    const projectMap = new Map<string, Project>()

    for (const session of sessions) {
      const key = session.project
      if (!projectMap.has(key)) {
        projectMap.set(key, {
          project: session.project,
          projectName: session.projectName,
          totalSessions: 0,
          lastUpdate: session.timestamp,
        })
      }
      const stats = projectMap.get(key)!
      stats.totalSessions++
      if (session.timestamp > stats.lastUpdate) {
        stats.lastUpdate = session.timestamp
      }
    }

    const projects = Array.from(projectMap.values())
      .sort((a, b) => b.lastUpdate - a.lastUpdate)

    return NextResponse.json({ projects } satisfies ProjectsResponse)
  } catch (error) {
    console.error('Error loading projects:', error)
    return NextResponse.json(
      { error: 'Failed to load projects' },
      { status: 500 }
    )
  }
}
