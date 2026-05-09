import { NextRequest, NextResponse } from 'next/server'
import { getDataSource } from '@/lib/data-source'
import { getUserId } from '@/lib/get-user-id'
import { exportSession, type ExtendedExportFormat } from '@/lib/export'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const format = (searchParams.get('format') || 'md') as ExtendedExportFormat

    const userId = await getUserId()
    const ds = getDataSource()
    const detail = await ds.loadSessionDetail(userId, id)

    if (!detail) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const content = exportSession(detail, format)

    if (!content) {
      return NextResponse.json(
        { error: 'Unsupported export format' },
        { status: 400 }
      )
    }

    let contentType = 'text/plain'
    let extension = 'txt'

    switch (format) {
      case 'md':
        contentType = 'text/markdown'
        extension = 'md'
        break
      case 'json':
        contentType = 'application/json'
        extension = 'json'
        break
      case 'html':
        contentType = 'text/html'
        extension = 'html'
        break
      case 'pdf':
        contentType = 'text/html'
        extension = 'html'
        break
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': format === 'pdf'
          ? 'inline'
          : `attachment; filename="session-${id}.${extension}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting session:', error)
    return NextResponse.json(
      { error: 'Failed to export session' },
      { status: 500 }
    )
  }
}
