import { NextRequest, NextResponse } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ds = getPipelineDataSource()
    const item = await ds.getItem(Number(params.id))
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    return NextResponse.json(item)
  } catch (error) {
    console.error('Error getting pipeline item:', error)
    return NextResponse.json({ error: 'Failed to get item' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const ds = getPipelineDataSource()
    await ds.updateItem(Number(params.id), body)
    const item = await ds.getItem(Number(params.id))
    return NextResponse.json(item)
  } catch (error) {
    console.error('Error updating pipeline item:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}
