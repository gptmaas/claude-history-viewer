import { NextRequest, NextResponse } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ds = getPipelineDataSource()
    const stages = await ds.getStagesForItem(Number(params.id))
    const stagesWithDetails = await Promise.all(
      stages.map(async (stage) => {
        const [artifacts, reviews] = await Promise.all([
          ds.listArtifacts(stage.id),
          ds.listReviews(stage.id),
        ])
        return { ...stage, artifacts, reviews }
      })
    )
    return NextResponse.json(stagesWithDetails)
  } catch (error) {
    console.error('Error getting pipeline stages:', error)
    return NextResponse.json({ error: 'Failed to get stages' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { transition, detail } = body
    if (!transition) {
      return NextResponse.json({ error: 'transition is required' }, { status: 400 })
    }
    const ds = getPipelineDataSource()
    const stage = await ds.transitionStage(Number(params.id), transition, detail)
    return NextResponse.json(stage)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to transition stage'
    console.error('Error transitioning pipeline stage:', error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
