import { NextRequest, NextResponse } from 'next/server'
import {
  loadDesktopConfig,
  saveDesktopConfig,
  detectDefaultSources,
  getConfigPath,
} from '@/lib/desktop-config'
import type { DesktopConfig, SourceConfig } from '@/lib/desktop-config'

export async function GET() {
  let config = await loadDesktopConfig()

  if (!config) {
    const sources = await detectDefaultSources()
    config = {
      mode: 'local-desktop',
      sources,
      lastOpenedAt: null,
    }
  }

  return NextResponse.json({
    ...config,
    configFilePath: getConfigPath(),
  })
}

export async function PUT(request: NextRequest) {
  try {
    const config = (await request.json()) as DesktopConfig

    if (!config.sources || !Array.isArray(config.sources)) {
      return NextResponse.json({ error: 'Invalid config: sources must be an array' }, { status: 400 })
    }

    for (const source of config.sources) {
      if (!source.type || !source.path) {
        return NextResponse.json(
          { error: 'Invalid source: type and path are required' },
          { status: 400 }
        )
      }
    }

    await saveDesktopConfig({
      mode: 'local-desktop',
      sources: config.sources as SourceConfig[],
      lastOpenedAt: config.lastOpenedAt,
    })

    // Reset source cache so next data load picks up new config
    const { resetSourceCache } = require('@/lib/claude-history') as { resetSourceCache: () => void }
    resetSourceCache()

    const { resetDataSource } = require('@/lib/data-source') as { resetDataSource: () => void }
    resetDataSource()

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save config' },
      { status: 500 }
    )
  }
}
