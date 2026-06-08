import { NextRequest, NextResponse } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ds = getPipelineDataSource()
    const artifacts = await ds.listArtifacts(Number(params.id))
    return NextResponse.json(artifacts)
  } catch (error) {
    console.error('Error listing artifacts:', error)
    return NextResponse.json({ error: 'Failed to list artifacts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { name, artifactType, content } = body
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const ds = getPipelineDataSource()
    const artifact = await ds.addArtifact(Number(params.id), name, artifactType ?? 'markdown', content ?? '')
    return NextResponse.json(artifact)
  } catch (error) {
    console.error('Error adding artifact:', error)
    return NextResponse.json({ error: 'Failed to add artifact' }, { status: 500 })
  }
}
