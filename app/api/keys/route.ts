import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateApiKey } from '@/lib/auth-server'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getDb()
    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, session.user.id),
      columns: {
        id: true,
        keyPrefix: true,
        name: true,
        lastUsedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ keys })
  } catch (error) {
    console.error('Error listing API keys:', error)
    return NextResponse.json({ error: 'Failed to list keys' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getDb()
    const { raw, hash, prefix } = generateApiKey()

    await db.insert(apiKeys).values({
      userId: session.user.id,
      keyHash: hash,
      keyPrefix: prefix,
      name: `key-${Date.now()}`,
    })

    return NextResponse.json({ apiKey: raw })
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { keyId } = await request.json()
    if (!keyId) {
      return NextResponse.json({ error: 'Key ID required' }, { status: 400 })
    }

    const db = getDb()
    await db.delete(apiKeys)
      .where(eq(apiKeys.id, keyId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json({ error: 'Failed to delete key' }, { status: 500 })
  }
}
