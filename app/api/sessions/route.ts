import { NextRequest, NextResponse } from 'next/server'
import { getDataSource } from '@/lib/data-source'
import { getUserId } from '@/lib/get-user-id'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const project = searchParams.get('project') || undefined
    const machine = searchParams.get('machine') || undefined
    const source = searchParams.get('source') || undefined

    const userId = await getUserId()
    const ds = getDataSource()
    const response = await ds.loadSessionsList(userId, page, pageSize, project, machine, source)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error loading sessions:', error)
    return NextResponse.json(
      { error: 'Failed to load sessions' },
      { status: 500 }
    )
  }
}
