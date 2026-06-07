import { NextRequest, NextResponse } from 'next/server'
import { detectDefaultSources, validateSourceDir } from '@/lib/desktop-config'

export async function GET() {
  const sources = await detectDefaultSources()
  return NextResponse.json({ sources })
}

export async function POST(request: NextRequest) {
  try {
    const { path: dirPath } = (await request.json()) as { path: string }

    if (!dirPath || typeof dirPath !== 'string') {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }

    const source = await validateSourceDir(dirPath)
    if (!source) {
      return NextResponse.json(
        { error: 'Invalid directory: cannot detect data source type' },
        { status: 400 }
      )
    }

    return NextResponse.json({ source })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 }
    )
  }
}
