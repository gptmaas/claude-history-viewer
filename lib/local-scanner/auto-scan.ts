import { fullScan } from './scanner'
import { indexScanResults as runIndex } from './indexer'
import { syncDesktopSources } from './source-sync'

let scanTimer: ReturnType<typeof setInterval> | null = null
let isScanning = false
let initialized = false

export async function initAutoScan(): Promise<void> {
  if (initialized) return
  initialized = true

  // Sync desktop config sources into local DB first
  await syncDesktopSources()

  // Run initial scan
  await triggerScan()

  // Set up periodic scan every 5 minutes
  if (!scanTimer) {
    scanTimer = setInterval(() => triggerScan(), 5 * 60 * 1000)
  }
}

export async function triggerScan(): Promise<void> {
  if (isScanning) return
  isScanning = true

  try {
    const results = await fullScan()
    if (results.some((r) => r.newFiles.length > 0 || r.changedFiles.length > 0 || r.deletedFileIds.length > 0)) {
      await runIndex(results)
    }
  } catch (err) {
    console.error('Auto-scan failed:', err)
  } finally {
    isScanning = false
  }
}

export function stopAutoScan(): void {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
  }
  initialized = false
}
