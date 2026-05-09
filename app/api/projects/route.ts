import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(request: NextRequest) {
  try {
    const machine = request.nextUrl.searchParams.get('machine') || undefined
    const source = request.nextUrl.searchParams.get('source') || undefined
    const userId = await getUserId()
    const ds = getDataSource()
    const projects = await ds.getProjects(userId, machine, source)

    return NextResponse.json({ projects } satisfies ProjectsResponse)
  } catch (error) {
    console.error('Error loading projects:', error)
    return NextResponse.json(
      { error: 'Failed to load projects' },
      { status: 500 }
    )
  }
}
