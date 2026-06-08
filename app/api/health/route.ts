import { NextResponse } from 'next/server'

export async function GET() {
  // In desktop mode, initialize SQLite and trigger auto-scan on first health check
  if (process.env.DATA_SOURCE_MODE === 'local' || process.env.DATA_SOURCE_MODE === 'local-desktop') {
    try {
      const { runMigrations } = require('@/lib/local-db/migrate') as typeof import('@/lib/local-db/migrate')
      runMigrations()

      // Start auto-scan in background (don't await)
      const { initAutoScan } = require('@/lib/local-scanner/auto-scan') as typeof import('@/lib/local-scanner/auto-scan')
      initAutoScan().catch((err: Error) => console.error('Auto-scan init failed:', err))
    } catch (err) {
      console.error('DB init failed:', err)
    }
  }

  return NextResponse.json({ status: 'ok' })
}
