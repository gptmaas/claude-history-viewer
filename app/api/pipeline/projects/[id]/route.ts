import { NextRequest, NextResponse } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ds = getPipelineDataSource()
    const project = await ds.getProject(Number(params.id))
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    return NextResponse.json(project)
  } catch (error) {
    console.error('Error getting pipeline project:', error)
    return NextResponse.json({ error: 'Failed to get project' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const ds = getPipelineDataSource()
    await ds.updateProject(Number(params.id), body)
    const project = await ds.getProject(Number(params.id))
    return NextResponse.json(project)
  } catch (error) {
    console.error('Error updating pipeline project:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}
