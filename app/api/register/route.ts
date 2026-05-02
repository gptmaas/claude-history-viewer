import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'
import { users, apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateApiKey } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (existing) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      )
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 12)
    const [newUser] = await db.insert(users).values({
      email,
      name: name || email.split('@')[0],
      passwordHash,
    }).returning()

    // Generate initial API key
    const { raw, hash, prefix } = generateApiKey()
    await db.insert(apiKeys).values({
      userId: newUser.id,
      keyHash: hash,
      keyPrefix: prefix,
      name: 'default',
    })

    return NextResponse.json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      apiKey: raw, // Only shown once
    })
  } catch (error) {
    console.error('Error registering user:', error)
    return NextResponse.json(
      { error: 'Failed to register' },
      { status: 500 }
    )
  }
}
