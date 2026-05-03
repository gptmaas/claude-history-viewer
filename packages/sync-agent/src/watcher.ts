import { watch } from 'chokidar'
import type { SyncConfig } from './config'
import { fullSync } from './sync'

let syncTimer: ReturnType<typeof setTimeout> | null = null
let isSyncing = false

export function startWatcher(config: SyncConfig): void {
  const watcher = watch(config.claudeDir, {
    persistent: true,
    ignoreInitial: true,
    depth: 10,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 500,
    },
  })

  watcher.on('all', (event, path) => {
    if (!path.endsWith('.jsonl')) return

    // Debounce: wait 2 seconds after last change before syncing
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      if (!isSyncing) {
        triggerSync(config)
      }
    }, 2000)
  })

  watcher.on('error', (error) => {
    console.error('Watcher error:', error)
  })

  console.log(`Watching ${config.claudeDir} for changes...`)
}

async function triggerSync(config: SyncConfig): Promise<void> {
  isSyncing = true
  try {
    const result = await fullSync(config)
    const time = new Date().toLocaleTimeString()
    if (result.error) {
      console.error(`[${time}] Sync failed: ${result.error}`)
    } else {
      console.log(`[${time}] Synced ${result.syncedFiles} files, ${result.skippedFiles} unchanged`)
    }
  } finally {
    isSyncing = false
  }
}
