import { NextRequest, NextResponse } from 'next/server'
import { getRawDb } from '@/lib/local-db/index'
import { maskApiKey } from '@/lib/ai/client'

export const dynamic = 'force-dynamic'

interface AiConfigRow {
  id: number
  name: string
  description: string | null
  provider: string
  api_key: string | null
  base_url: string | null
  model: string
  is_active: number
  project_dir: string | null
  created_at: number
  updated_at: number
}

export async function GET() {
  try {
    const db = getRawDb()
    const configs = db.prepare('SELECT * FROM ai_config ORDER BY updated_at DESC').all() as AiConfigRow[]

    return NextResponse.json(configs.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      provider: c.provider,
      apiKey: maskApiKey(c.api_key),
      apiKeySet: !!c.api_key,
      baseUrl: c.base_url,
      model: c.model,
      isActive: c.is_active,
      projectDir: c.project_dir,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    })))
  } catch (error) {
    console.error('Error listing AI configs:', error)
    return NextResponse.json({ error: 'Failed to list AI configs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, provider, apiKey, baseUrl, model, projectDir } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const db = getRawDb()
    const now = Date.now()

    const existing = db.prepare('SELECT COUNT(*) as count FROM ai_config').get() as { count: number }
    const shouldBeActive = existing.count === 0 || body.isActive !== false

    if (shouldBeActive) {
      db.prepare('UPDATE ai_config SET is_active = 0').run()
    }

    const result = db.prepare(
      `INSERT INTO ai_config (name, description, provider, api_key, base_url, model, is_active, project_dir, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      name,
      description ?? null,
      provider ?? 'anthropic',
      apiKey ?? null,
      baseUrl ?? null,
      model ?? 'claude-sonnet-4-6-20250627',
      shouldBeActive ? 1 : 0,
      projectDir ?? null,
      now,
      now,
    )

    return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
  } catch (error) {
    console.error('Error creating AI config:', error)
    return NextResponse.json({ error: 'Failed to create AI config' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, description, provider, apiKey, baseUrl, model, isActive, projectDir } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const db = getRawDb()
    const now = Date.now()

    if (isActive) {
      db.prepare('UPDATE ai_config SET is_active = 0').run()
    }

    const updates: string[] = []
    const values: unknown[] = []

    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (description !== undefined) { updates.push('description = ?'); values.push(description) }
    if (provider !== undefined) { updates.push('provider = ?'); values.push(provider) }
    if (apiKey !== undefined) { updates.push('api_key = ?'); values.push(apiKey) }
    if (baseUrl !== undefined) { updates.push('base_url = ?'); values.push(baseUrl) }
    if (model !== undefined) { updates.push('model = ?'); values.push(model) }
    if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0) }
    if (projectDir !== undefined) { updates.push('project_dir = ?'); values.push(projectDir) }

    updates.push('updated_at = ?')
    values.push(now)
    values.push(id)

    db.prepare(`UPDATE ai_config SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error updating AI config:', error)
    return NextResponse.json({ error: 'Failed to update AI config' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const db = getRawDb()
    db.prepare('DELETE FROM ai_config WHERE id = ?').run(id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting AI config:', error)
    return NextResponse.json({ error: 'Failed to delete AI config' }, { status: 500 })
  }
}
