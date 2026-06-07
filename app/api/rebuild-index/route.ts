import { NextResponse } from 'next/server'
import { rebuildIndex } from '@/lib/local-scanner/indexer'

export async function POST() {
  try {
    const result = await rebuildIndex()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Rebuild failed' }, { status: 500 })
  }
}
