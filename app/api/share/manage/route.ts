import { NextRequest, NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { sharedLinks, sessions } from '@/lib/db/schema'
import { getUserId } from '@/lib/get-user-id'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getDb()

    const links = await db
      .select({
        slug: sharedLinks.slug,
        sessionId: sharedLinks.sessionId,
        expiresAt: sharedLinks.expiresAt,
        viewCount: sharedLinks.viewCount,
        isActive: sharedLinks.isActive,
        createdAt: sharedLinks.createdAt,
        sessionDisplay: sessions.display,
      })
      .from(sharedLinks)
      .innerJoin(sessions, eq(sharedLinks.sessionId, sessions.id))
      .where(eq(sharedLinks.ownerId, userId))
      .orderBy(desc(sharedLinks.createdAt))

    return NextResponse.json({ links })
  } catch (error) {
    console.error('Error listing share links:', error)
    return NextResponse.json({ error: 'Failed to list share links' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { slug } = body as { slug: string }

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    const db = getDb()

    // Verify ownership and revoke
    const result = await db
      .update(sharedLinks)
      .set({ isActive: false })
      .where(eq(sharedLinks.slug, slug))
      .returning({ ownerId: sharedLinks.ownerId })

    if (result.length === 0) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    // Verify ownership (the update matched but we should confirm it's the right owner)
    if (result[0].ownerId !== userId) {
      return NextResponse.json({ error: 'Not authorized to revoke this link' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error revoking share link:', error)
    return NextResponse.json({ error: 'Failed to revoke share link' }, { status: 500 })
  }
}
