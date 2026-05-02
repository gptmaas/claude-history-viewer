import { NextResponse } from 'next/server'
import { getDataSource } from '@/lib/data-source'
import { getUserId } from '@/lib/get-user-id'

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
    const userId = await getUserId()
    const ds = getDataSource()
    const projects = await ds.getProjects(userId)

    return NextResponse.json({ projects } satisfies ProjectsResponse)
  } catch (error) {
    console.error('Error loading projects:', error)
    return NextResponse.json(
      { error: 'Failed to load projects' },
      { status: 500 }
    )
  }
}
