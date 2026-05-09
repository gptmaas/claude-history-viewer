import { watch } from 'chokidar'
import type { SyncConfig } from './config'
import { fullSync } from './sync'
import { createSources } from './sources'

let syncTimer: ReturnType<typeof setTimeout> | null = null
let isSyncing = false

export function startWatcher(config: SyncConfig): void {
  const sourceNames = config.sources ?? ['claude-code']
  const sources = createSources(sourceNames, config.sourceDirs)

  for (const source of sources) {
    const watcher = watch(source.watchDir, {
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

      if (syncTimer) clearTimeout(syncTimer)
      syncTimer = setTimeout(() => {
        if (!isSyncing) {
          triggerSync(config)
        }
      }, 2000)
    })

    watcher.on('error', (error) => {
      console.error(`Watcher error (${source.name}):`, error)
    })

    console.log(`Watching ${source.watchDir} (${source.label}) for changes...`)
  }
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
