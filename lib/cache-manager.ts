/**
 * Cache Manager
 *
 * In-memory LRU cache with file-based persistence
 * Supports pattern-based invalidation and TTL
 */

import { mkdir, writeFile, readFile, access } from 'fs/promises'
import { join } from 'path'
import { cacheConfig } from './cache-config'

interface CacheEntry<T> {
  data: T
  expiresAt: number
  createdAt: number
}

type InvalidationCallback = (pattern: string) => void | Promise<void>

/**
 * LRU Cache with TTL and file persistence
 */
class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>
  private maxSize: number
  private ttl: number

  constructor(maxSize: number, ttl: number) {
    this.cache = new Map()
    this.maxSize = maxSize
    this.ttl = ttl
  }

  /**
   * Get a value from the cache
   * Returns null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.data
  }

  /**
   * Set a value in the cache
   */
  set(key: string, data: T): void {
    // Remove oldest if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttl,
      createdAt: Date.now(),
    })
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get current size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Invalidate entries matching a pattern
   * Supports wildcards: 'stats:*' matches all keys starting with 'stats:'
   */
  invalidate(pattern: string): number {
    let count = 0
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    )

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        count++
      }
    }
    return count
  }

  /**
   * Get all keys matching a pattern
   */
  keys(pattern?: string): string[] {
    if (!pattern) {
      return Array.from(this.cache.keys())
    }

    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    )
    return Array.from(this.cache.keys()).filter(key => regex.test(key))
  }

  /**
   * Get all entries (for persistence)
   */
  entries(): Array<{ key: string; entry: CacheEntry<T> }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry,
    }))
  }

  /**
   * Set entries from persisted data
   */
  setEntries(entries: Array<{ key: string; entry: CacheEntry<T> }>): void {
    for (const { key, entry } of entries) {
      // Skip expired entries
      if (Date.now() <= entry.expiresAt) {
        this.cache.set(key, entry)
      }
    }
  }
}

/**
 * Cache Manager with file persistence
 */
export class CacheManager {
  private caches: Map<string, LRUCache<unknown>>
  private invalidationCallbacks: Set<InvalidationCallback>
  private persistentCache: Map<string, LRUCache<unknown>>
  private persistDir: string
  private initialized: Set<string>

  constructor(persistDir?: string) {
    this.caches = new Map()
    this.invalidationCallbacks = new Set()
    this.persistentCache = new Map()
    this.persistDir = persistDir || join(process.cwd(), cacheConfig.CACHE_DIR)
    this.initialized = new Set()
  }

  /**
   * Get or create a cache with specific TTL and max size
   */
  private getCache<T>(name: string, ttl: number, maxSize: number): LRUCache<T> {
    let cache = this.caches.get(name) as LRUCache<T> | undefined

    if (!cache) {
      cache = new LRUCache<T>(maxSize, ttl)
      this.caches.set(name, cache as LRUCache<unknown>)
    }

    return cache
  }

  /**
   * Get a value from cache
   * @param cacheName - Name of the cache (e.g., 'stats', 'sessions')
   * @param key - Cache key
   * @param ttl - Time-to-live in milliseconds
   * @param maxSize - Maximum cache size
   */
  get<T>(cacheName: string, key: string, ttl: number, maxSize: number = 100): T | null {
    const cache = this.getCache<T>(cacheName, ttl, maxSize)
    return cache.get(key)
  }

  /**
   * Set a value in cache
   */
  set<T>(cacheName: string, key: string, data: T, ttl: number, maxSize: number = 100): void {
    const cache = this.getCache<T>(cacheName, ttl, maxSize)
    cache.set(key, data)
  }

  /**
   * Invalidate cache entries matching a pattern
   * @param pattern - Pattern to match (supports wildcards)
   * @param cacheName - Optional cache name to limit invalidation
   */
  invalidate(pattern: string, cacheName?: string): number {
    let totalInvalidated = 0

    if (cacheName) {
      const cache = this.caches.get(cacheName)
      if (cache) {
        totalInvalidated = cache.invalidate(pattern)
      }
    } else {
      for (const cache of this.caches.values()) {
        totalInvalidated += cache.invalidate(pattern)
      }
    }

    // Trigger callbacks
    for (const callback of this.invalidationCallbacks) {
      try {
        callback(pattern)
      } catch (error) {
        console.error('Cache invalidation callback error:', error)
      }
    }

    return totalInvalidated
  }

  /**
   * Register a callback for cache invalidation
   */
  onInvalidate(callback: InvalidationCallback): () => void {
    this.invalidationCallbacks.add(callback)
    return () => this.invalidationCallbacks.delete(callback)
  }

  /**
   * Persist a cache to disk
   */
  async persist<T>(cacheName: string, filename: string): Promise<void> {
    const cache = this.caches.get(cacheName) as LRUCache<T> | undefined
    if (!cache) return

    try {
      // Ensure directory exists
      await mkdir(this.persistDir, { recursive: true })

      const filepath = join(this.persistDir, filename)
      const data = JSON.stringify(cache.entries())
      await writeFile(filepath, data, 'utf-8')
    } catch (error) {
      console.error(`Failed to persist cache ${cacheName}:`, error)
    }
  }

  /**
   * Restore a cache from disk
   * @param cacheName - Name of the cache
   * @param filename - File to restore from
   * @param ttl - Optional TTL to ensure cache exists with these parameters
   * @param maxSize - Optional max size to ensure cache exists with these parameters
   */
  async restore<T>(cacheName: string, filename: string, ttl?: number, maxSize?: number): Promise<void> {
    if (this.initialized.has(cacheName)) {
      return
    }

    // Ensure cache exists with specified parameters before restoring
    if (ttl !== undefined && maxSize !== undefined) {
      this.getCache<object>(cacheName, ttl, maxSize)
    }

    try {
      const filepath = join(this.persistDir, filename)
      await access(filepath)

      const data = await readFile(filepath, 'utf-8')
      const entries = JSON.parse(data) as Array<{ key: string; entry: CacheEntry<T> }>

      const cache = this.caches.get(cacheName) as LRUCache<T> | undefined
      if (cache) {
        cache.setEntries(entries)
      }

      this.initialized.add(cacheName)
    } catch (error) {
      // File doesn't exist or error reading - not a problem for first run
      this.initialized.add(cacheName)
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear()
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): Record<string, { size: number; keys: string[] }> {
    const stats: Record<string, { size: number; keys: string[] }> = {}

    for (const [name, cache] of this.caches.entries()) {
      stats[name] = {
        size: cache.size(),
        keys: cache.keys(),
      }
    }

    return stats
  }
}

// Global cache manager instance
let globalCacheManager: CacheManager | null = null

/**
 * Get the global cache manager instance
 */
export function getCacheManager(): CacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new CacheManager()
  }
  return globalCacheManager
}

/**
 * Reset the global cache manager (useful for testing)
 */
export function resetCacheManager(): void {
  if (globalCacheManager) {
    globalCacheManager.clearAll()
  }
  globalCacheManager = null
}
