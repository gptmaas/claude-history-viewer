import { NextRequest, NextResponse } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    const ds = getPipelineDataSource()
    const items = await ds.listItems(Number(projectId))
    return NextResponse.json(items)
  } catch (error) {
    console.error('Error listing pipeline items:', error)
    return NextResponse.json({ error: 'Failed to list items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, title, background, goals, acceptanceCriteria, priority, sourceSessionId } = body
    if (!projectId || !title) {
      return NextResponse.json({ error: 'projectId and title are required' }, { status: 400 })
    }
    const ds = getPipelineDataSource()
    const item = await ds.createItem({ projectId, title, background, goals, acceptanceCriteria, priority, sourceSessionId })
    return NextResponse.json(item)
  } catch (error) {
    console.error('Error creating pipeline item:', error)
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}
