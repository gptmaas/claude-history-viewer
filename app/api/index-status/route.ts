import { NextResponse } from 'next/server'
import { getIndexStatus } from '@/lib/local-scanner/indexer'

export async function GET() {
  try {
    const status = await getIndexStatus()
    return NextResponse.json(status)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to get index status' }, { status: 500 })
  }
}
