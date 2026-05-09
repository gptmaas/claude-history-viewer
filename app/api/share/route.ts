import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'
import { sessions, sharedLinks, users } from '@/lib/db/schema'
import { getUserId } from '@/lib/get-user-id'
import { generateSlug } from '@/lib/share-utils'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, expiresIn, password } = body as {
      sessionId: string
      expiresIn?: number
      password?: string
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const db = getDb()

    // Look up the session by sessionId string to get the database UUID
    const session = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.sessionId, sessionId)))
      .limit(1)

    if (session.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const sessionDbId = session[0].id
    const slug = generateSlug()

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 60 * 60 * 1000)
      : null

    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : null

    await db.insert(sharedLinks).values({
      ownerId: userId,
      sessionId: sessionDbId,
      slug,
      passwordHash,
      expiresAt,
    })

    const baseUrl = process.env.NEXTAUTH_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`
    const url = `${baseUrl}/share/${slug}`

    return NextResponse.json({ slug, url })
  } catch (error) {
    console.error('Error creating share link:', error)
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 })
  }
}
