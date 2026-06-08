import { NextRequest, NextResponse } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ds = getPipelineDataSource()
    const projects = await ds.listProjects()
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error listing pipeline projects:', error)
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description } = body
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const ds = getPipelineDataSource()
    const project = await ds.createProject(name, description)
    return NextResponse.json(project)
  } catch (error) {
    console.error('Error creating pipeline project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
