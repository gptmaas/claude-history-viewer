import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { createHash } from 'crypto'
import type { SyncConfig } from './config'
import { scanAllJsonlFiles } from './scanner'

interface SyncResult {
  syncedFiles: number
  skippedFiles: number
  totalFiles: number
  error?: string
}

interface FileCache {
  [filePath: string]: string // filePath -> contentHash
}

const CACHE_FILE = join(homedir(), '.claude-sync', 'file-cache.json')
const MAX_BATCH_SIZE = 5 * 1024 * 1024 // 5MB per batch

function loadFileCache(): FileCache {
  if (!existsSync(CACHE_FILE)) return {}
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveFileCache(cache: FileCache): void {
  const dir = join(homedir(), '.claude-sync')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(CACHE_FILE, JSON.stringify(cache))
}

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

async function pushBatch(
  config: SyncConfig,
  files: Array<{ filePath: string; content: string; contentHash: string; mtime: string; size: number }>
): Promise<{ acceptedFiles: number; skippedFiles: number; error?: string }> {
  try {
    const response = await fetch(`${config.serverUrl}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        machineId: config.machineId,
        files,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      return { acceptedFiles: 0, skippedFiles: 0, error: `HTTP ${response.status}: ${body}` }
    }

    const data = await response.json()
    return {
      acceptedFiles: data.acceptedFiles ?? 0,
      skippedFiles: data.skippedFiles ?? 0,
    }
  } catch (error) {
    return {
      acceptedFiles: 0,
      skippedFiles: 0,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

export async function fullSync(config: SyncConfig): Promise<SyncResult> {
  const allFiles = scanAllJsonlFiles(config.claudeDir)
  const localCache = loadFileCache()

  // Determine which files need uploading (new or changed)
  const toUpload: Array<{ filePath: string; content: string; contentHash: string; mtime: string; size: number }> = []

  for (const file of allFiles) {
    const content = readFileSync(file.absolutePath, 'utf-8')
    const hash = computeHash(content)

    if (localCache[file.relativePath] === hash) {
      continue // unchanged
    }

    toUpload.push({
      filePath: file.relativePath,
      content,
      contentHash: hash,
      mtime: new Date(file.mtime).toISOString(),
      size: file.size,
    })
  }

  if (toUpload.length === 0) {
    return { syncedFiles: 0, skippedFiles: allFiles.length, totalFiles: allFiles.length }
  }

  // Batch by total payload size
  let totalAccepted = 0
  let totalSkipped = 0
  let lastError: string | undefined

  let batch: typeof toUpload = []
  let batchSize = 0

  for (const file of toUpload) {
    const entrySize = Buffer.byteLength(JSON.stringify(file), 'utf-8')
    if (batchSize + entrySize > MAX_BATCH_SIZE && batch.length > 0) {
      const result = await pushBatch(config, batch)
      if (result.error) {
        lastError = result.error
      } else {
        totalAccepted += result.acceptedFiles
        totalSkipped += result.skippedFiles
        // Update local cache for accepted files
        for (const f of batch) {
          localCache[f.filePath] = f.contentHash
        }
      }
      batch = []
      batchSize = 0
    }
    batch.push(file)
    batchSize += entrySize
  }

  // Push remaining batch
  if (batch.length > 0) {
    const result = await pushBatch(config, batch)
    if (result.error) {
      lastError = result.error
    } else {
      totalAccepted += result.acceptedFiles
      totalSkipped += result.skippedFiles
      for (const f of batch) {
        localCache[f.filePath] = f.contentHash
      }
    }
  }

  // Update local cache
  saveFileCache(localCache)

  return {
    syncedFiles: totalAccepted,
    skippedFiles: totalSkipped,
    totalFiles: allFiles.length,
    error: lastError,
  }
}

export async function getSyncStatus(config: SyncConfig): Promise<{
  lastSyncAt: string | null
  machineId: string | null
  totalSessions: number
  totalMessages: number
  totalRawFiles: number
  pendingParseCount: number
  error?: string
}> {
  try {
    const response = await fetch(`${config.serverUrl}/api/sync/status`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
    })

    if (!response.ok) {
      return {
        lastSyncAt: null,
        machineId: null,
        totalSessions: 0,
        totalMessages: 0,
        totalRawFiles: 0,
        pendingParseCount: 0,
        error: `HTTP ${response.status}`,
      }
    }

    return await response.json()
  } catch (error) {
    return {
      lastSyncAt: null,
      machineId: null,
      totalSessions: 0,
      totalMessages: 0,
      totalRawFiles: 0,
      pendingParseCount: 0,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}
