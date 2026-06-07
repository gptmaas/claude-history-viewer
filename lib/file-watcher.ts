/**
 * File Watcher
 *
 * Watches Claude Code history files for changes and invalidates cache
 * Supports multiple source directories in desktop mode
 * Uses debouncing to avoid excessive invalidations
 */

import { watch, FSWatcher } from 'fs'
import { join } from 'path'
import { cacheConfig } from './cache-config'
import { invalidateStatsCache } from './stats-cache'
import { invalidateAllSessionCaches } from './session-cache'
import { isDesktopMode } from './desktop-mode'

type InvalidationHandler = (path: string) => void | Promise<void>

/**
 * File watcher with debouncing
 */
class FileWatcher {
  private watchers: Map<string, FSWatcher>
  private debounceTimers: Map<string, NodeJS.Timeout>
  private handlers: Set<InvalidationHandler>
  private enabled: boolean

  constructor() {
    this.watchers = new Map()
    this.debounceTimers = new Map()
    this.handlers = new Set()
    this.enabled = false
  }

  /**
   * Start watching files from all configured source directories
   */
  start(): void {
    if (this.enabled) return

    try {
      const sourceDirs = this.getSourceDirs()
      for (const dir of sourceDirs) {
        const historyFile = join(dir, 'history.jsonl')
        const projectsDir = join(dir, 'projects')
        this.watchFile(historyFile, 'history')
        this.watchDirectory(projectsDir, 'projects')
      }
      this.enabled = true
    } catch (error) {
      console.error('Failed to start file watcher:', error)
    }
  }

  private getSourceDirs(): string[] {
    const home = process.env.HOME || ''
    if (process.env.DATA_SOURCE_MODE === 'local-desktop') {
      // In desktop mode, read source paths from env or use defaults
      const configDir = process.env.DESKTOP_CONFIG_DIR
      if (configDir) {
        // Try to load config synchronously - if it fails, use defaults
        try {
          const fs = require('fs')
          const configPath = join(configDir, 'desktop-config.json')
          if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
            return config.sources
              ?.filter((s: { enabled: boolean }) => s.enabled)
              ?.map((s: { path: string }) => s.path) || [join(home, '.claude')]
          }
        } catch {}
      }
    }
    return [process.env.CLAUDE_DIR || join(home, '.claude')]
  }

  /**
   * Stop watching files
   */
  stop(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
    this.debounceTimers.clear()
    this.enabled = false
  }

  /**
   * Watch a single file
   */
  private watchFile(filepath: string, type: string): void {
    try {
      const watcher = watch(filepath, (eventType) => {
        if (eventType === 'change') {
          this.triggerDebounced(filepath, type)
        }
      })
      this.watchers.set(filepath, watcher)
    } catch (error) {
      // File might not exist yet - that's okay
      console.debug(`Could not watch ${filepath}:`, error)
    }
  }

  /**
   * Watch a directory for changes
   */
  private watchDirectory(dirpath: string, type: string): void {
    try {
      const watcher = watch(dirpath, (eventType, filename) => {
        if (filename && eventType === 'change') {
          const fullPath = join(dirpath, filename)
          this.triggerDebounced(fullPath, type)
        }
      })
      this.watchers.set(dirpath, watcher)
    } catch (error) {
      // Directory might not exist yet - that's okay
      console.debug(`Could not watch ${dirpath}:`, error)
    }
  }

  /**
   * Trigger debounced invalidation
   */
  private triggerDebounced(filepath: string, type: string): void {
    // Clear existing timer for this file
    const existingTimer = this.debounceTimers.get(filepath)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.handleFileChange(filepath, type)
      this.debounceTimers.delete(filepath)
    }, cacheConfig.WATCHER_DEBOUNCE_MS)

    this.debounceTimers.set(filepath, timer)
  }

  /**
   * Handle file change after debounce
   * Invalidates caches selectively based on what changed
   */
  private async handleFileChange(filepath: string, type: string): Promise<void> {
    console.debug(`File changed: ${filepath} (${type})`)

    try {
      // In desktop mode, trigger incremental SQLite indexing
      if (isDesktopMode()) {
        const { triggerScan } = require('./local-scanner/auto-scan') as typeof import('./local-scanner/auto-scan')
        triggerScan().catch((err: Error) => console.error('Incremental scan failed:', err))
      }

      // Invalidate caches based on what changed
      if (type === 'history' || filepath.endsWith('history.jsonl')) {
        await invalidateStatsCache()
      } else if (filepath.includes('projects')) {
        await invalidateStatsCache()
      }

      // Trigger custom handlers
      for (const handler of this.handlers) {
        try {
          await handler(filepath)
        } catch (error) {
          console.error('File change handler error:', error)
        }
      }
    } catch (error) {
      console.error('Error handling file change:', error)
    }
  }

  /**
   * Register a custom handler for file changes
   */
  onChange(handler: InvalidationHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  /**
   * Check if watcher is enabled
   */
  isActive(): boolean {
    return this.enabled
  }
}

// Global file watcher instance
let globalFileWatcher: FileWatcher | null = null

/**
 * Get the global file watcher instance
 */
export function getFileWatcher(): FileWatcher {
  if (!globalFileWatcher) {
    globalFileWatcher = new FileWatcher()
  }
  return globalFileWatcher
}

/**
 * Start the file watcher (call this on app startup)
 */
export function startFileWatcher(): void {
  const watcher = getFileWatcher()
  watcher.start()
}

/**
 * Stop the file watcher
 */
export function stopFileWatcher(): void {
  if (globalFileWatcher) {
    globalFileWatcher.stop()
  }
}
