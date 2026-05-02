/**
 * Cache configuration
 *
 * TTL values for different cache types
 */

export const cacheConfig = {
  // Time-to-live for stats cache (30 minutes - extended from 5 for better performance)
  STATS_TTL: 30 * 60 * 1000,

  // Time-to-live for session list cache (2 minutes)
  SESSION_LIST_TTL: 2 * 60 * 1000,

  // Time-to-live for session detail cache (10 minutes)
  SESSION_DETAIL_TTL: 10 * 60 * 1000,

  // Maximum number of session details to cache
  MAX_SESSION_DETAILS: 100,

  // Cache directory for persistent cache
  CACHE_DIR: '.cache',

  // File watcher debounce delay (500ms)
  WATCHER_DEBOUNCE_MS: 500,
} as const
