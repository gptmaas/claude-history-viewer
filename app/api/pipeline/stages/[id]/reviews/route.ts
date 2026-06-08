import { NextRequest, NextResponse } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ds = getPipelineDataSource()
    const reviews = await ds.listReviews(Number(params.id))
    return NextResponse.json(reviews)
  } catch (error) {
    console.error('Error listing reviews:', error)
    return NextResponse.json({ error: 'Failed to list reviews' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { result, comment, reviewerType } = body
    if (!result) {
      return NextResponse.json({ error: 'result is required' }, { status: 400 })
    }
    const ds = getPipelineDataSource()
    const review = await ds.addReview(Number(params.id), result, comment, reviewerType)
    return NextResponse.json(review)
  } catch (error) {
    console.error('Error adding review:', error)
    return NextResponse.json({ error: 'Failed to add review' }, { status: 500 })
  }
}
