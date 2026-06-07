import { readFileSync } from 'fs'
import { eq, and, sql as drizzleSql } from 'drizzle-orm'
import { getDb } from '../local-db/index'
import { localRawFiles, localSessions, localMessages, localSources, localIndexRuns } from '../local-db/schema'
import { getParser } from '../parsers/registry'
import type { ParsedSession, ParsedMessage } from '../parsers/types'
import { computeFileHash, scanSource, fullScan, type ScanResult, type DiscoveredFile } from './scanner'

const CURRENT_PARSE_VERSION = 2

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

export interface IndexResult {
  filesTotal: number
  filesParsed: number
  filesFailed: number
  totalSessions: number
  totalMessages: number
}

export async function indexScanResults(results: ScanResult[]): Promise<IndexResult> {
  const db = getDb()
  const summary: IndexResult = { filesTotal: 0, filesParsed: 0, filesFailed: 0, totalSessions: 0, totalMessages: 0 }

  for (const result of results) {
    const filesToIndex: Array<{ file: DiscoveredFile; dbId?: number }> = [
      ...result.newFiles.map((f) => ({ file: f })),
      ...result.changedFiles.map((f) => ({ file: f as DiscoveredFile, dbId: f.dbId })),
    ]

    // Delete removed files
    for (const id of result.deletedFileIds) {
      await db.delete(localRawFiles).where(eq(localRawFiles.id, id))
    }

    if (filesToIndex.length === 0 && result.deletedFileIds.length === 0) continue

    // Create index run record
    const runId = await createIndexRun(result.sourceId, filesToIndex.length)

    try {
      const fileResult = await indexFilesForSource(db, result.sourceId, result.sourceType, filesToIndex)
      summary.filesTotal += filesToIndex.length
      summary.filesParsed += fileResult.filesParsed
      summary.filesFailed += fileResult.filesFailed
      summary.totalSessions += fileResult.totalSessions
      summary.totalMessages += fileResult.totalMessages

      await completeIndexRun(runId, fileResult.filesParsed, fileResult.filesFailed)
    } catch (err) {
      summary.filesTotal += filesToIndex.length
      summary.filesFailed += filesToIndex.length
      await failIndexRun(runId, err instanceof Error ? err.message : String(err))
    }

    // Update source last scan time
    await db.update(localSources)
      .set({ lastScanAt: new Date() })
      .where(eq(localSources.id, result.sourceId))
  }

  return summary
}

async function indexFilesForSource(
  db: ReturnType<typeof getDb>,
  sourceId: number,
  sourceType: string,
  files: Array<{ file: DiscoveredFile; dbId?: number }>,
): Promise<{ filesParsed: number; filesFailed: number; totalSessions: number; totalMessages: number }> {
  const parser = getParser(sourceType)
  if (!parser) {
    console.warn(`No parser for source type: ${sourceType}`)
    return { filesParsed: 0, filesFailed: files.length, totalSessions: 0, totalMessages: 0 }
  }

  let filesParsed = 0
  let filesFailed = 0
  let totalSessions = 0
  let totalMessages = 0

  // Separate index files from session data files
  const indexFiles: Array<{ file: DiscoveredFile; dbId?: number; content: string }> = []
  const sessionFiles: Array<{ file: DiscoveredFile; dbId?: number; content: string }> = []

  for (const { file, dbId } of files) {
    try {
      const content = readFileSync(file.absolutePath, 'utf-8')
      const hash = computeFileHash(file.absolutePath)

      if (file.relativePath === 'history.jsonl' || file.relativePath === 'session_index.jsonl') {
        indexFiles.push({ file, dbId, content })
      } else {
        sessionFiles.push({ file, dbId, content })
      }

      // Upsert raw file record
      if (dbId) {
        await db.update(localRawFiles)
          .set({ mtime: file.mtime, size: file.size, hash, status: 'pending', parseVersion: CURRENT_PARSE_VERSION, errorMessage: null })
          .where(eq(localRawFiles.id, dbId))
      } else {
        await db.insert(localRawFiles).values({
          sourceId,
          path: file.relativePath,
          mtime: file.mtime,
          size: file.size,
          hash,
          status: 'pending',
          parseVersion: CURRENT_PARSE_VERSION,
        })
      }
    } catch (err) {
      filesFailed++
      const errMsg = err instanceof Error ? err.message : String(err)
      if (dbId) {
        await db.update(localRawFiles)
          .set({ status: 'failed', errorMessage: errMsg })
          .where(eq(localRawFiles.id, dbId))
      }
    }
  }

  // Parse sessions from index files
  const sessionMap = new Map<string, ParsedSession>()
  for (const { content } of indexFiles) {
    const parsed = parser.parseHistoryIndex(content)
    for (const [sid, session] of parsed) {
      const existing = sessionMap.get(sid)
      if (!existing || session.timestamp > existing.timestamp) {
        sessionMap.set(sid, session)
      }
    }
  }

  // Parse messages from session files
  const messagesBySession = new Map<string, ParsedMessage[]>()
  for (const { content } of sessionFiles) {
    const msgsBySid = parser.parseSessionData(content)
    for (const [sid, msgs] of msgsBySid) {
      if (!messagesBySession.has(sid)) {
        messagesBySession.set(sid, [])
      }
      messagesBySession.get(sid)!.push(...msgs)
    }
  }

  // Merge sessions from messages not in index
  for (const [sid, msgs] of messagesBySession) {
    const firstMsg = msgs[0]
    if (!sessionMap.has(sid)) {
      const project = firstMsg?.project || ''
      sessionMap.set(sid, {
        sessionId: sid,
        display: firstMsg?.display || 'Untitled Session',
        project,
        projectName: project ? project.split('/').pop() || '' : '',
        messageCount: msgs.length,
        timestamp: firstMsg?.timestamp ? new Date(firstMsg.timestamp).getTime() : Date.now(),
      })
    } else {
      const existing = sessionMap.get(sid)!
      if (!existing.project && firstMsg?.project) {
        existing.project = firstMsg.project
        existing.projectName = firstMsg.project.split('/').pop() || ''
      }
      existing.messageCount = msgs.length
    }
  }

  // Upsert sessions
  for (const session of sessionMap.values()) {
    const startedAt = session.timestamp
    const msgs = messagesBySession.get(session.sessionId) || []

    let firstMessageAt: number | null = null
    let lastMessageAt: number | null = null
    for (const m of msgs) {
      if (m.timestamp) {
        const ts = new Date(m.timestamp).getTime()
        if (!firstMessageAt || ts < firstMessageAt) firstMessageAt = ts
        if (!lastMessageAt || ts > lastMessageAt) lastMessageAt = ts
      }
    }

    const durationSeconds = firstMessageAt && lastMessageAt
      ? Math.floor((lastMessageAt - firstMessageAt) / 1000)
      : null

    const existingSession = await db.query.localSessions.findFirst({
      where: eq(localSessions.sessionId, session.sessionId),
    })

    if (existingSession) {
      await db.update(localSessions)
        .set({
          display: session.display || existingSession.display,
          project: session.project || existingSession.project,
          projectName: session.projectName || existingSession.projectName,
          messageCount: session.messageCount || existingSession.messageCount,
          sourceId,
          lastMessageAt: lastMessageAt || existingSession.lastMessageAt,
          firstMessageAt: firstMessageAt || existingSession.firstMessageAt,
          durationSeconds: durationSeconds ?? existingSession.durationSeconds,
          sourceType,
          updatedAt: new Date(),
        })
        .where(eq(localSessions.id, existingSession.id))
    } else {
      await db.insert(localSessions).values({
        sourceId,
        sessionId: session.sessionId,
        display: session.display || 'Untitled',
        project: session.project || 'unknown',
        projectName: session.projectName || 'unknown',
        messageCount: session.messageCount,
        startedAt,
        lastMessageAt,
        firstMessageAt,
        durationSeconds,
        sourceType,
      })
    }
    totalSessions++
  }

  // Upsert messages (dedup by uuid)
  for (const [sid, msgs] of messagesBySession) {
    const sessionRecord = await db.query.localSessions.findFirst({
      where: eq(localSessions.sessionId, sid),
    })
    if (!sessionRecord) continue

    for (const m of msgs) {
      if (!m.uuid) continue

      const existingMsg = await db.query.localMessages.findFirst({
        where: eq(localMessages.uuid, m.uuid),
      })

      if (existingMsg) {
        if (m.model || m.usage) {
          await db.update(localMessages)
            .set({
              model: m.model ?? existingMsg.model,
              usage: m.usage ?? existingMsg.usage,
            })
            .where(eq(localMessages.id, existingMsg.id))
        }
        continue
      }

      const searchText = extractSearchText(m.content)

      await db.insert(localMessages).values({
        sessionId: sessionRecord.id,
        type: m.type,
        role: m.role ?? null,
        content: m.content,
        uuid: m.uuid,
        timestamp: m.timestamp ? new Date(m.timestamp).getTime() : null,
        model: m.model ?? null,
        usage: m.usage ?? null,
        searchText,
      })
      totalMessages++
    }
  }

  // Mark raw files as parsed
  for (const { file, dbId } of files) {
    const id = dbId || await getRawFileId(sourceId, file.relativePath)
    if (id) {
      await db.update(localRawFiles)
        .set({ status: 'parsed' })
        .where(eq(localRawFiles.id, id))
    }
  }

  filesParsed = indexFiles.length + sessionFiles.length

  return { filesParsed, filesFailed, totalSessions, totalMessages }
}

async function getRawFileId(sourceId: number, path: string): Promise<number | null> {
  const db = getDb()
  const record = await db.query.localRawFiles.findFirst({
    where: and(eq(localRawFiles.sourceId, sourceId), eq(localRawFiles.path, path)),
  })
  return record?.id ?? null
}

async function createIndexRun(sourceId: number, filesTotal: number): Promise<number> {
  const db = getDb()
  const result = await db.insert(localIndexRuns).values({
    sourceId,
    status: 'running',
    filesTotal,
    startedAt: new Date(),
  }).returning({ id: localIndexRuns.id })
  return result[0].id
}

async function completeIndexRun(runId: number, filesParsed: number, filesFailed: number): Promise<void> {
  const db = getDb()
  await db.update(localIndexRuns)
    .set({ status: 'completed', filesParsed, filesFailed, completedAt: new Date() })
    .where(eq(localIndexRuns.id, runId))
}

async function failIndexRun(runId: number, errorMessage: string): Promise<void> {
  const db = getDb()
  await db.update(localIndexRuns)
    .set({ status: 'failed', completedAt: new Date(), errorMessage })
    .where(eq(localIndexRuns.id, runId))
}

export async function rebuildIndex(): Promise<IndexResult> {
  const db = getDb()

  // Delete all indexed data
  await db.delete(localMessages)
  await db.delete(localSessions)
  await db.delete(localRawFiles)
  await db.delete(localIndexRuns)

  // Reset raw file statuses
  await db.update(localRawFiles).set({ status: 'pending', parseVersion: 0 })

  // Full rescan
  const results = await fullScan()
  return indexScanResults(results)
}

export async function getIndexStatus(): Promise<{
  sources: Array<{
    id: number
    type: string
    path: string
    lastScanAt: number | null
    totalFiles: number
    parsedFiles: number
    failedFiles: number
  }>
  totalSessions: number
  totalMessages: number
  lastRunAt: number | null
}> {
  const db = getDb()

  const sources = await db.select().from(localSources)
  const sourceStats = []

  for (const source of sources) {
    const files = await db.select().from(localRawFiles).where(eq(localRawFiles.sourceId, source.id))
    sourceStats.push({
      id: source.id,
      type: source.type,
      path: source.path,
      lastScanAt: source.lastScanAt ? source.lastScanAt.getTime() : null,
      totalFiles: files.length,
      parsedFiles: files.filter((f) => f.status === 'parsed').length,
      failedFiles: files.filter((f) => f.status === 'failed').length,
    })
  }

  const sessionCount = await db.select({ count: drizzleSql`count(*)` }).from(localSessions)
  const messageCount = await db.select({ count: drizzleSql`count(*)` }).from(localMessages)

  const lastRun = await db.select().from(localIndexRuns).orderBy(drizzleSql`${localIndexRuns.startedAt} DESC`).limit(1)

  return {
    sources: sourceStats,
    totalSessions: (sessionCount[0] as { count: number })?.count ?? 0,
    totalMessages: (messageCount[0] as { count: number })?.count ?? 0,
    lastRunAt: lastRun[0]?.startedAt?.getTime() ?? null,
  }
}
