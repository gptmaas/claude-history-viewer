import { NextResponse } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ds = getPipelineDataSource()
    const dashboard = await ds.getPipelineDashboard()
    return NextResponse.json(dashboard)
  } catch (error) {
    console.error('Error getting pipeline dashboard:', error)
    return NextResponse.json({ error: 'Failed to get dashboard' }, { status: 500 })
  }
}
