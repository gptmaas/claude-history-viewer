/**
 * File Watcher
 *
 * Watches Claude Code history files for changes and invalidates cache
 * Uses debouncing to avoid excessive invalidations
 */

import { watch, FSWatcher } from 'fs'
import { join } from 'path'
import { cacheConfig } from './cache-config'
import { invalidateStatsCache } from './stats-cache'
import { invalidateAllSessionCaches } from './session-cache'

// Default Claude Code history location
const DEFAULT_CLAUDE_DIR = join(process.env.HOME || '', '.claude')
const HISTORY_FILE = join(DEFAULT_CLAUDE_DIR, 'history.jsonl')
const PROJECTS_DIR = join(DEFAULT_CLAUDE_DIR, 'projects')

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
   * Start watching files
   */
  start(): void {
    if (this.enabled) return

    try {
      this.watchFile(HISTORY_FILE, 'history')
      this.watchDirectory(PROJECTS_DIR, 'projects')
      this.enabled = true
    } catch (error) {
      console.error('Failed to start file watcher:', error)
    }
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

    // Invalidate caches based on what changed
    try {
      if (type === 'history' || filepath.endsWith('history.jsonl')) {
        // History file changed - the session list changed, so we need to invalidate stats
        // Session details are likely still valid, so let them expire naturally
        await invalidateStatsCache()
        // Don't invalidate all session caches - they will be refreshed as needed
      } else if (filepath.includes('projects')) {
        // Session file changed - only invalidate stats
        // Session cache will be refreshed on next access
        await invalidateStatsCache()
        // Don't invalidate all sessions - let them expire naturally
        // This prevents a cascade of cache invalidations on every file change
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
