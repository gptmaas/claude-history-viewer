import { NextRequest, NextResponse } from 'next/server'
import { getDataSource } from '@/lib/data-source'
import { getUserId } from '@/lib/get-user-id'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const userId = await getUserId()
    const ds = getDataSource()
    const detail = await ds.loadSessionDetail(userId, id)

    if (!detail) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const session = detail.session
    const sessionWithDate = {
      ...session,
      date: typeof session.date === 'string' ? session.date : (session.date as Date).toISOString(),
    }

    return NextResponse.json({
      session: sessionWithDate,
      messages: detail.messages,
    })
  } catch (error) {
    console.error('Error loading session detail:', error)
    return NextResponse.json(
      { error: 'Failed to load session detail' },
      { status: 500 }
    )
  }
}
