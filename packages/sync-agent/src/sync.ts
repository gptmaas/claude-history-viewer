import type { SyncConfig } from './config'
import { parseHistoryFile, parseSessionFile, findSessionProjectDirs } from './parser'

interface SyncResult {
  syncedSessions: number
  syncedMessages: number
  error?: string
}

interface ParsedSession {
  sessionId: string
  display: string
  project: string
  projectName: string
  messageCount: number
  timestamp: number
}

interface ParsedMessage {
  type: string
  role?: string
  content: unknown
  uuid: string
  sessionId: string
  timestamp?: string
}

const BATCH_SIZE = 50 // sessions per batch

async function pushBatch(
  config: SyncConfig,
  sessions: ParsedSession[],
  messages: ParsedMessage[]
): Promise<{ syncedSessions: number; syncedMessages: number; error?: string }> {
  try {
    const response = await fetch(`${config.serverUrl}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        sessions,
        messages,
        sourceType: 'claude-code',
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      return { syncedSessions: 0, syncedMessages: 0, error: `HTTP ${response.status}: ${body}` }
    }

    const data = await response.json()
    return { syncedSessions: data.syncedSessions ?? 0, syncedMessages: data.syncedMessages ?? 0 }
  } catch (error) {
    return {
      syncedSessions: 0,
      syncedMessages: 0,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

export async function fullSync(config: SyncConfig): Promise<SyncResult> {
  const sessions = parseHistoryFile(config.claudeDir)
  const projectDirs = findSessionProjectDirs(config.claudeDir)

  // Build a map of session -> messages
  const sessionMessages = new Map<string, ParsedMessage[]>()
  for (const session of sessions) {
    for (const dir of projectDirs) {
      const msgs = parseSessionFile(config.claudeDir, session.sessionId, dir)
      if (msgs.length > 0) {
        session.messageCount = msgs.length
        sessionMessages.set(session.sessionId, msgs)
        break
      }
    }
  }

  if (sessions.length === 0) {
    return { syncedSessions: 0, syncedMessages: 0 }
  }

  let totalSyncedSessions = 0
  let totalSyncedMessages = 0
  let lastError: string | undefined

  // Process in batches
  for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
    const batchSessions = sessions.slice(i, i + BATCH_SIZE)
    const batchMessages: ParsedMessage[] = []

    for (const s of batchSessions) {
      const msgs = sessionMessages.get(s.sessionId)
      if (msgs) {
        batchMessages.push(...msgs)
      }
    }

    const result = await pushBatch(config, batchSessions, batchMessages)

    if (result.error) {
      lastError = result.error
      // Continue with next batch instead of failing entirely
      continue
    }

    totalSyncedSessions += result.syncedSessions
    totalSyncedMessages += result.syncedMessages
  }

  return {
    syncedSessions: totalSyncedSessions,
    syncedMessages: totalSyncedMessages,
    error: lastError,
  }
}

export async function getSyncStatus(config: SyncConfig): Promise<{
  lastSyncAt: string | null
  totalSessions: number
  totalMessages: number
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
        totalSessions: 0,
        totalMessages: 0,
        error: `HTTP ${response.status}`,
      }
    }

    return await response.json()
  } catch (error) {
    return {
      lastSyncAt: null,
      totalSessions: 0,
      totalMessages: 0,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}
