import { getDb } from './db'
import { rawFiles, sessions, messages, syncState } from './db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { getParser } from './parsers/registry'
import type { ParsedSession, ParsedMessage } from './parsers/types'

const CURRENT_PARSE_VERSION = 1

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

interface RawFileWithSource {
  id: string
  filePath: string
  content: string
  sourceType: string
}

export async function parseAllPendingRawFiles(
  userId: string,
  machineId: string,
  machineName?: string,
  sourceTypeOverride?: string,
): Promise<{
  parsedFiles: number
  totalSessions: number
  totalMessages: number
}> {
  const db = getDb()

  const pendingFiles = await db.select({
    id: rawFiles.id,
    filePath: rawFiles.filePath,
    content: rawFiles.content,
    sourceType: rawFiles.sourceType,
  })
    .from(rawFiles)
    .where(and(
      eq(rawFiles.userId, userId),
      eq(rawFiles.machineId, machineId),
      sql`(${rawFiles.parsedAt} IS NULL OR ${rawFiles.parseVersion} < ${CURRENT_PARSE_VERSION})`
    )) as RawFileWithSource[]

  if (pendingFiles.length === 0) {
    return { parsedFiles: 0, totalSessions: 0, totalMessages: 0 }
  }

  // Group files by sourceType
  const filesBySource = new Map<string, RawFileWithSource[]>()
  for (const file of pendingFiles) {
    const st = sourceTypeOverride || file.sourceType || 'claude-code'
    if (!filesBySource.has(st)) {
      filesBySource.set(st, [])
    }
    filesBySource.get(st)!.push(file)
  }

  let totalSessions = 0
  let totalMessages = 0

  for (const [sourceType, files] of filesBySource) {
    const parser = getParser(sourceType)
    if (!parser) {
      console.warn(`No parser found for source type: ${sourceType}, skipping ${files.length} files`)
      continue
    }

    const result = await parseFilesWithParser(db, parser, files, userId, machineId, machineName, sourceType)
    totalSessions += result.totalSessions
    totalMessages += result.totalMessages
  }

  // Mark all raw files as parsed
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
  for (const sourceType of filesBySource.keys()) {
    await db.insert(syncState).values({
      userId,
      machineId,
      machineName: machineName || null,
      sourceType,
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
  }

  return { parsedFiles: pendingFiles.length, totalSessions, totalMessages }
}

async function parseFilesWithParser(
  db: ReturnType<typeof getDb>,
  parser: { parseHistoryIndex(content: string): Map<string, ParsedSession>; parseSessionData(content: string): Map<string, ParsedMessage[]> },
  files: RawFileWithSource[],
  userId: string,
  machineId: string,
  machineName: string | undefined,
  sourceType: string,
): Promise<{ totalSessions: number; totalMessages: number }> {
  // Separate history/index files from session data files
  const historyFiles: RawFileWithSource[] = []
  const sessionFiles: RawFileWithSource[] = []

  for (const file of files) {
    if (file.filePath === 'history.jsonl' || file.filePath === 'session_index.jsonl') {
      historyFiles.push(file)
    } else {
      sessionFiles.push(file)
    }
  }

  // Parse session metadata from index files
  // For Codex CLI, session_index.jsonl has cwd/thread_name while history.jsonl only has timestamps
  // We prioritize metadata from session_index.jsonl over history.jsonl
  const sessionMap = new Map<string, ParsedSession>()
  let sessionIndexProcessed = false

  for (const hf of historyFiles) {
    const parsed = parser.parseHistoryIndex(hf.content)
    for (const [sid, session] of parsed) {
      const existing = sessionMap.get(sid)
      const isSessionIndex = hf.filePath === 'session_index.jsonl'

      // If session_index.jsonl has been processed, prefer its metadata
      // Otherwise, take the entry with later timestamp or the new one
      if (!existing) {
        sessionMap.set(sid, session)
      } else if (isSessionIndex && !sessionIndexProcessed) {
        // session_index.jsonl has cwd/thread_name - use its metadata if we don't have it from session_index yet
        if (!existing.project && session.project) {
          sessionMap.set(sid, session)
        }
        // session_index entries have meaningful timestamps from updated_at field
      } else if (session.timestamp > existing.timestamp) {
        sessionMap.set(sid, session)
      }
    }
    if (hf.filePath === 'session_index.jsonl') {
      sessionIndexProcessed = true
    }
  }

  // Parse messages from session data files
  const messagesBySession = new Map<string, ParsedMessage[]>()
  const sessionSourceFiles = new Map<string, Set<string>>()

  for (const sf of sessionFiles) {
    const msgsBySid = parser.parseSessionData(sf.content)
    for (const sid of Array.from(msgsBySid.keys())) {
      const msgs = msgsBySid.get(sid)!
      if (!messagesBySession.has(sid)) {
        messagesBySession.set(sid, [])
        sessionSourceFiles.set(sid, new Set())
      }
      messagesBySession.get(sid)!.push(...msgs)
      sessionSourceFiles.get(sid)!.add(sf.filePath)
    }
  }

  // Include sessions from messages not in index, or update project info from messages
  for (const sid of Array.from(messagesBySession.keys())) {
    const msgs = messagesBySession.get(sid)!
    // Extract session metadata from messages if available (Codex CLI stores cwd in session_meta)
    const firstMsg = msgs[0]
    const sessionProject = firstMsg?.project || ''
    const sessionDisplay = firstMsg?.display || ''
    const sessionProjectName = sessionProject ? (sessionProject.split('/').pop() || '') : ''

    if (!sessionMap.has(sid)) {
      // New session - add it
      sessionMap.set(sid, {
        sessionId: sid,
        display: sessionDisplay || 'Untitled Session',
        project: sessionProject,
        projectName: sessionProjectName,
        messageCount: msgs.length,
        timestamp: msgs[0]?.timestamp ? new Date(msgs[0].timestamp).getTime() : Date.now(),
      })
    } else {
      // Session exists - update project info if current is empty
      const existing = sessionMap.get(sid)!
      if (!existing.project && sessionProject) {
        existing.project = sessionProject
        existing.projectName = sessionProjectName
      }
      if (!existing.display && sessionDisplay) {
        existing.display = sessionDisplay
      }
      existing.messageCount = msgs.length
    }
  }

  // Update message counts and calculate session duration
  for (const sid of Array.from(messagesBySession.keys())) {
    const msgs = messagesBySession.get(sid)!
    const session = sessionMap.get(sid)
    if (session) {
      session.messageCount = msgs.length
    }
  }

  // Calculate first/last message timestamps per session for duration computation
  const sessionTimestamps = new Map<string, { first: Date; last: Date }>()
  for (const sid of Array.from(messagesBySession.keys())) {
    const msgs = messagesBySession.get(sid)!
    let firstTs: Date | null = null
    let lastTs: Date | null = null
    for (const m of msgs) {
      if (m.timestamp) {
        const ts = new Date(m.timestamp)
        if (!firstTs || ts < firstTs) firstTs = ts
        if (!lastTs || ts > lastTs) lastTs = ts
      }
    }
    if (firstTs && lastTs) {
      sessionTimestamps.set(sid, { first: firstTs, last: lastTs })
    }
  }

  // Upsert sessions
  let totalSessions = 0
  let totalMessages = 0

  for (const session of Array.from(sessionMap.values())) {
    const startedAt = new Date(session.timestamp)
    const sourcePaths = sessionSourceFiles.get(session.sessionId)
    const tsData = sessionTimestamps.get(session.sessionId)
    const firstMessageAt = tsData?.first || startedAt
    const lastMessageAt = tsData?.last || startedAt
    const durationSeconds = tsData ? Math.floor((tsData.last.getTime() - tsData.first.getTime()) / 1000) : null

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
          lastMessageAt,
          firstMessageAt,
          durationSeconds: durationSeconds ?? existing.durationSeconds,
          machineId,
          machineName: machineName || existing.machineName,
          sourceFilePaths: sourcePaths ? Array.from(sourcePaths).join(',') : existing.sourceFilePaths,
          sourceType,
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
        sourceType,
        startedAt,
        lastMessageAt,
        firstMessageAt,
        durationSeconds,
      })
    }
    totalSessions++
  }

  // Insert messages (dedup by uuid)
  for (const sid of Array.from(messagesBySession.keys())) {
    const msgs = messagesBySession.get(sid)!
    for (const m of msgs) {
      if (!m.uuid) continue

      const sessionRecord = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.userId, userId),
          eq(sessions.sessionId, m.sessionId),
        ),
      })
      if (!sessionRecord) continue

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
        searchTsvector: sql`to_tsvector('simple', ${searchText})`,
      })
      totalMessages++
    }
  }

  return { totalSessions, totalMessages }
}
