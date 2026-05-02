/**
 * Session Cache
 *
 * Caches session list and session details with different TTLs
 */

import { loadSessionsList, loadSessionDetail } from './claude-history'
import { getCacheManager } from './cache-manager'
import { cacheConfig } from './cache-config'
import type { Session, SessionDetail } from './types'

const SESSION_LIST_CACHE = 'session-list'
const SESSION_DETAIL_CACHE = 'session-detail'
const SESSION_LIST_KEY = 'all'
const PERSIST_FILE = 'sessions.json'

interface CachedSessionList {
  sessions: Session[]
  lastUpdated: number
}

interface CachedSessionDetail extends SessionDetail {
  cachedAt: number
}

/**
 * Session cache class
 */
class SessionCache {
  private cache = getCacheManager()
  private initialized = false

  /**
   * Initialize the cache (restore from disk)
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return

    // Note: We don't restore session details from disk as they may be stale
    // Only restore the session list
    try {
      await this.cache.restore<CachedSessionList>(SESSION_LIST_CACHE, PERSIST_FILE)
    } catch {
      // Ignore errors
    }
    this.initialized = true
  }

  /**
   * Get session list from cache or load from disk
   */
  async getSessionList(): Promise<Session[]> {
    await this.initialize()

    const cached = this.cache.get<CachedSessionList>(
      SESSION_LIST_CACHE,
      SESSION_LIST_KEY,
      cacheConfig.SESSION_LIST_TTL,
      1
    )

    if (cached) {
      return cached.sessions
    }

    // Load and cache
    const sessions = await loadSessionsList()
    this.cache.set(
      SESSION_LIST_CACHE,
      SESSION_LIST_KEY,
      { sessions, lastUpdated: Date.now() },
      cacheConfig.SESSION_LIST_TTL,
      1
    )

    // Persist to disk
    await this.cache.persist(SESSION_LIST_CACHE, PERSIST_FILE)

    return sessions
  }

  /**
   * Get session detail from cache or load from disk
   */
  async getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
    await this.initialize()

    const cached = this.cache.get<CachedSessionDetail>(
      SESSION_DETAIL_CACHE,
      sessionId,
      cacheConfig.SESSION_DETAIL_TTL,
      cacheConfig.MAX_SESSION_DETAILS
    )

    if (cached) {
      return {
        session: cached.session,
        messages: cached.messages,
        projectPath: cached.projectPath,
      }
    }

    // Load and cache
    const detail = await loadSessionDetail(sessionId)
    if (detail) {
      this.cache.set(
        SESSION_DETAIL_CACHE,
        sessionId,
        { ...detail, cachedAt: Date.now() },
        cacheConfig.SESSION_DETAIL_TTL,
        cacheConfig.MAX_SESSION_DETAILS
      )
    }

    return detail
  }

  /**
   * Invalidate session list cache
   */
  async invalidateSessionList(): Promise<void> {
    await this.initialize()
    this.cache.invalidate(SESSION_LIST_KEY, SESSION_LIST_CACHE)
  }

  /**
   * Invalidate a specific session detail cache
   */
  async invalidateSessionDetail(sessionId: string): Promise<void> {
    await this.initialize()
    this.cache.invalidate(sessionId, SESSION_DETAIL_CACHE)
  }

  /**
   * Invalidate all session caches
   */
  async invalidateAll(): Promise<void> {
    await this.initialize()
    this.cache.invalidate('*', SESSION_LIST_CACHE)
    this.cache.invalidate('*', SESSION_DETAIL_CACHE)
  }

  /**
   * Preload session details (useful for background warming)
   */
  async preloadSessionDetails(sessionIds: string[]): Promise<void> {
    await this.initialize()

    // Load in parallel but limit concurrency
    const batchSize = 5
    for (let i = 0; i < sessionIds.length; i += batchSize) {
      const batch = sessionIds.slice(i, i + batchSize)
      await Promise.all(
        batch.map(id => this.getSessionDetail(id))
      )
    }
  }
}

// Global session cache instance
let globalSessionCache: SessionCache | null = null

/**
 * Get the global session cache instance
 */
export function getSessionCache(): SessionCache {
  if (!globalSessionCache) {
    globalSessionCache = new SessionCache()
  }
  return globalSessionCache
}

/**
 * Invalidate session list cache
 */
export async function invalidateSessionListCache(): Promise<void> {
  if (globalSessionCache) {
    await globalSessionCache.invalidateSessionList()
  }
}

/**
 * Invalidate a specific session detail cache
 */
export async function invalidateSessionDetailCache(sessionId: string): Promise<void> {
  if (globalSessionCache) {
    await globalSessionCache.invalidateSessionDetail(sessionId)
  }
}

/**
 * Invalidate all session caches
 */
export async function invalidateAllSessionCaches(): Promise<void> {
  if (globalSessionCache) {
    await globalSessionCache.invalidateAll()
  }
}
