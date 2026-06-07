import { NextResponse } from 'next/server'
import { fullScan } from '@/lib/local-scanner/scanner'
import { indexScanResults } from '@/lib/local-scanner/indexer'

export async function POST() {
  try {
    const results = await fullScan()
    const summary = await indexScanResults(results)
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scan failed' }, { status: 500 })
  }
}
