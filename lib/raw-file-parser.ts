import { getDb } from './db'
import { rawFiles, sessions, messages, syncState } from './db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'

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

const CURRENT_PARSE_VERSION = 1

function parseProjectName(projectPath: string): string {
  const parts = projectPath.split('/')
  return parts[parts.length - 1] || projectPath
}

function parseHistoryJsonl(content: string): Map<string, ParsedSession> {
  const lines = content.trim().split('\n').filter(Boolean)
  const sessionMap = new Map<string, { sessionId: string; display: string; project: string; timestamp: number }>()

  for (const line of lines) {
    try {
      const entry = JSON.parse(line)
      if (!entry.sessionId) continue
      const existing = sessionMap.get(entry.sessionId)
      if (!existing || entry.timestamp > existing.timestamp) {
        sessionMap.set(entry.sessionId, {
          sessionId: entry.sessionId,
          display: entry.display,
          project: entry.project,
          timestamp: entry.timestamp,
        })
      }
    } catch {}
  }

  const result = new Map<string, ParsedSession>()
  for (const sid of Array.from(sessionMap.keys())) {
    const entry = sessionMap.get(sid)!
    result.set(sid, {
      sessionId: entry.sessionId,
      display: entry.display,
      project: entry.project,
      projectName: parseProjectName(entry.project),
      messageCount: 0,
      timestamp: entry.timestamp,
    })
  }
  return result
}

function parseSessionJsonl(content: string): Map<string, ParsedMessage[]> {
  const lines = content.trim().split('\n').filter(Boolean)
  const result = new Map<string, ParsedMessage[]>()

  for (const line of lines) {
    try {
      const msg = JSON.parse(line)
      const t = msg.type

      if (t === 'file-history-snapshot' || t === 'permission-mode' || t === 'progress' || t === 'attachment') continue

      const sessionId = msg.sessionId
      if (!sessionId) continue

      let parsed: ParsedMessage | null = null

      if (t === 'user') {
        const rawContent = msg.message?.content
        const isToolResult = Array.isArray(rawContent) && rawContent[0]?.type === 'tool_result'
        if (isToolResult) continue

        const uuid = msg.uuid
        if (!uuid) continue

        parsed = {
          type: 'user',
          role: 'user',
          content: rawContent || msg.content,
          uuid,
          sessionId,
          timestamp: msg.timestamp,
        }
      } else if (msg.message?.role === 'assistant') {
        const uuid = msg.uuid || msg.message?.id
        if (!uuid) continue

        parsed = {
          type: 'assistant',
          role: 'assistant',
          content: msg.message?.content || msg.content,
          uuid,
          sessionId,
          timestamp: msg.timestamp,
        }
      } else if (t === 'tool_use') {
        const uuid = msg.uuid || msg.id
        if (!uuid) continue

        parsed = {
          type: 'tool_use',
          content: msg.content || JSON.stringify(msg),
          uuid,
          sessionId,
          timestamp: msg.timestamp,
        }
      } else if (t === 'tool_result') {
        const uuid = msg.uuid || msg.id
        if (!uuid) continue

        parsed = {
          type: 'tool_result',
          content: msg.content || msg.result || JSON.stringify(msg),
          uuid,
          sessionId,
          timestamp: msg.timestamp,
        }
      }

      if (parsed) {
        if (!result.has(sessionId)) {
          result.set(sessionId, [])
        }
        result.get(sessionId)!.push(parsed)
      }
    } catch {}
  }

  return result
}

function extractSearchText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
      .map((block) => block.text)
      .join(' ')
  }
  return JSON.stringify(content)
}

export async function parseAllPendingRawFiles(userId: string, machineId: string, machineName?: string): Promise<{
  parsedFiles: number
  totalSessions: number
  totalMessages: number
}> {
  const db = getDb()

  // Fetch all un-parsed raw files for this user+machine
  const pendingFiles = await db.select()
    .from(rawFiles)
    .where(and(
      eq(rawFiles.userId, userId),
      eq(rawFiles.machineId, machineId),
      sql`(${rawFiles.parsedAt} IS NULL OR ${rawFiles.parseVersion} < ${CURRENT_PARSE_VERSION})`
    ))

  if (pendingFiles.length === 0) {
    return { parsedFiles: 0, totalSessions: 0, totalMessages: 0 }
  }

  // Separate history.jsonl from session files
  let historyContent: string | null = null
  const sessionFiles: { filePath: string; content: string }[] = []

  for (const file of pendingFiles) {
    if (file.filePath === 'history.jsonl') {
      historyContent = file.content
    } else if (file.filePath.startsWith('projects/')) {
      sessionFiles.push({ filePath: file.filePath, content: file.content })
    }
  }

  // Parse sessions from history.jsonl
  const sessionMap = historyContent ? parseHistoryJsonl(historyContent) : new Map<string, ParsedSession>()

  // Parse messages from all session/subagent files, grouped by sessionId
  const messagesBySession = new Map<string, ParsedMessage[]>()
  const sessionSourceFiles = new Map<string, Set<string>>()

  for (const { filePath, content } of sessionFiles) {
    const msgsBySid = parseSessionJsonl(content)
    for (const sid of Array.from(msgsBySid.keys())) {
      const msgs = msgsBySid.get(sid)!
      if (!messagesBySession.has(sid)) {
        messagesBySession.set(sid, [])
        sessionSourceFiles.set(sid, new Set())
      }
      messagesBySession.get(sid)!.push(...msgs)
      sessionSourceFiles.get(sid)!.add(filePath)
    }
  }

  // Also include sessions found in messages but not in history.jsonl
  for (const sid of Array.from(messagesBySession.keys())) {
    if (!sessionMap.has(sid)) {
      const msgs = messagesBySession.get(sid)!
      sessionMap.set(sid, {
        sessionId: sid,
        display: 'Untitled Session',
        project: '',
        projectName: '',
        messageCount: msgs.length,
        timestamp: msgs[0]?.timestamp ? new Date(msgs[0].timestamp).getTime() : Date.now(),
      })
    }
  }

  // Update message counts
  for (const sid of Array.from(messagesBySession.keys())) {
    const msgs = messagesBySession.get(sid)!
    const session = sessionMap.get(sid)
    if (session) {
      session.messageCount = msgs.length
    }
  }

  // Upsert sessions
  let totalSessions = 0
  let totalMessages = 0

  for (const session of Array.from(sessionMap.values())) {
    const startedAt = new Date(session.timestamp)
    const sourcePaths = sessionSourceFiles.get(session.sessionId)

    const existing = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.userId, userId),
        eq(sessions.sessionId, session.sessionId),
      ),
    })

    if (existing) {
      await db.update(sessions)
        .set({
          display: session.display || existing.display,
          project: session.project || existing.project,
          projectName: session.projectName || existing.projectName,
          messageCount: session.messageCount || existing.messageCount,
          lastMessageAt: startedAt,
          machineId,
          machineName: machineName || existing.machineName,
          sourceFilePaths: sourcePaths ? Array.from(sourcePaths).join(',') : existing.sourceFilePaths,
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, existing.id))
    } else {
      await db.insert(sessions).values({
        userId,
        machineId,
        machineName: machineName || null,
        sessionId: session.sessionId,
        display: session.display || 'Untitled',
        project: session.project || 'unknown',
        projectName: session.projectName || 'unknown',
        messageCount: session.messageCount,
        sourceFilePaths: sourcePaths ? Array.from(sourcePaths).join(',') : null,
        startedAt,
        lastMessageAt: startedAt,
      })
    }
    totalSessions++
  }

  // Insert messages (dedup by uuid)
  for (const sid of Array.from(messagesBySession.keys())) {
    const msgs = messagesBySession.get(sid)!
    for (const m of msgs) {
      if (!m.uuid) continue

      // Find the session record
      const sessionRecord = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.userId, userId),
          eq(sessions.sessionId, m.sessionId),
        ),
      })
      if (!sessionRecord) continue

      // Check for duplicate
      const existingMsg = await db.query.messages.findFirst({
        where: eq(messages.uuid, m.uuid),
      })
      if (existingMsg) continue

      const searchText = extractSearchText(m.content)

      await db.insert(messages).values({
        sessionId: sessionRecord.id,
        userId,
        type: m.type,
        role: m.role ?? null,
        content: m.content,
        uuid: m.uuid,
        timestamp: m.timestamp ? new Date(m.timestamp) : null,
        searchVector: searchText,
      })
      totalMessages++
    }
  }

  // Mark raw files as parsed
  for (const file of pendingFiles) {
    await db.update(rawFiles)
      .set({
        parsedAt: new Date(),
        parseVersion: CURRENT_PARSE_VERSION,
        updatedAt: new Date(),
      })
      .where(eq(rawFiles.id, file.id))
  }

  // Update sync state
  await db.insert(syncState).values({
    userId,
    machineId,
    machineName: machineName || null,
    sourceType: 'claude-code',
    lastSyncedAt: new Date(),
    syncCursor: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: [syncState.userId, syncState.sourceType, syncState.machineId],
    set: {
      lastSyncedAt: new Date(),
      syncCursor: new Date().toISOString(),
      updatedAt: new Date(),
    },
  })

  return { parsedFiles: pendingFiles.length, totalSessions, totalMessages }
}
