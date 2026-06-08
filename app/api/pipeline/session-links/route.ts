import { NextRequest, NextResponse } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const ds = getPipelineDataSource()
    const itemId = sp.get('itemId')
    const stageId = sp.get('stageId')
    const sessionId = sp.get('sessionId')

    if (itemId) {
      const links = await ds.getSessionLinksForItem(Number(itemId))
      return NextResponse.json(links)
    }
    if (stageId) {
      const links = await ds.getSessionLinksForStage(Number(stageId))
      return NextResponse.json(links)
    }
    if (sessionId) {
      const links = await ds.getSessionLinksForSession(sessionId)
      return NextResponse.json(links)
    }
    return NextResponse.json({ error: 'itemId, stageId, or sessionId is required' }, { status: 400 })
  } catch (error) {
    console.error('Error getting session links:', error)
    return NextResponse.json({ error: 'Failed to get session links' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { itemId, stageId, sessionId, linkType, note } = body
    if (!itemId || !sessionId || !linkType) {
      return NextResponse.json({ error: 'itemId, sessionId, and linkType are required' }, { status: 400 })
    }
    const ds = getPipelineDataSource()
    const link = await ds.addSessionLink(itemId, stageId ?? null, sessionId, linkType, note)
    return NextResponse.json(link)
  } catch (error) {
    console.error('Error creating session link:', error)
    return NextResponse.json({ error: 'Failed to create session link' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const ds = getPipelineDataSource()
    await ds.removeSessionLink(Number(id))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error removing session link:', error)
    return NextResponse.json({ error: 'Failed to remove session link' }, { status: 500 })
  }
}
