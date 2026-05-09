import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'
import { sharedLinks, sessions, users } from '@/lib/db/schema'
import { getDataSource } from '@/lib/data-source'
import { sanitizeSessionForShare } from '@/lib/share-utils'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Prevent accessing /api/share/manage through this route
    if (slug === 'manage') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const db = getDb()

    // Look up the shared link
    const links = await db
      .select({
        id: sharedLinks.id,
        ownerId: sharedLinks.ownerId,
        sessionId: sharedLinks.sessionId,
        passwordHash: sharedLinks.passwordHash,
        expiresAt: sharedLinks.expiresAt,
        isActive: sharedLinks.isActive,
        createdAt: sharedLinks.createdAt,
      })
      .from(sharedLinks)
      .where(eq(sharedLinks.slug, slug))
      .limit(1)

    if (links.length === 0) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
    }

    const link = links[0]

    if (!link.isActive) {
      return NextResponse.json({ error: 'Share link has been revoked' }, { status: 410 })
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })
    }

    // Password verification
    if (link.passwordHash) {
      const passwordParam = request.nextUrl.searchParams.get('password')
      if (!passwordParam) {
        return NextResponse.json({ error: 'Password required', requiresPassword: true }, { status: 403 })
      }
      const valid = await bcrypt.compare(passwordParam, link.passwordHash)
      if (!valid) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 403 })
      }
    }

    // Increment view count
    await db
      .update(sharedLinks)
      .set({ viewCount: sql`${sharedLinks.viewCount} + 1` })
      .where(eq(sharedLinks.id, link.id))

    // Look up session to get the sessionId string
    const sessionRows = await db
      .select({
        sessionId: sessions.sessionId,
      })
      .from(sessions)
      .where(eq(sessions.id, link.sessionId))
      .limit(1)

    if (sessionRows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Load session detail using DataSource
    const ds = getDataSource()
    const detail = await ds.loadSessionDetail(link.ownerId, sessionRows[0].sessionId)

    if (!detail) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get owner name
    const ownerRows = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, link.ownerId))
      .limit(1)

    const ownerName = ownerRows[0]?.name || 'Anonymous'

    // Sanitize and return
    const sanitized = sanitizeSessionForShare(detail)

    return NextResponse.json({
      session: {
        ...sanitized.session,
        date: sanitized.session.date instanceof Date
          ? sanitized.session.date.toISOString()
          : sanitized.session.date,
      },
      messages: sanitized.messages,
      sharedAt: link.createdAt,
      ownerName,
    })
  } catch (error) {
    console.error('Error accessing share link:', error)
    return NextResponse.json({ error: 'Failed to access share link' }, { status: 500 })
  }
}
