import { getDb } from '../lib/db'
import { sessions, rawFiles } from '../lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { createHash } from 'crypto'

// Parse Codex CLI session files to extract cwd and thread_name from session_meta
function extractSessionMetaFromContent(content: string): Map<string, { cwd: string; threadName: string }> {
  const result = new Map<string, { cwd: string; threadName: string }>()
  const lines = content.trim().split('\n').filter(Boolean)

  for (const line of lines) {
    try {
      const record = JSON.parse(line)
      if (record.type === 'session_meta' && record.payload) {
        const sessionId = record.payload.id
        if (sessionId) {
          result.set(sessionId, {
            cwd: record.payload.cwd || '',
            threadName: record.payload.thread_name || '',
          })
        }
      }
    } catch {}
  }

  return result
}

async function fixCodexSessions() {
  const db = getDb()

  // Find all Codex CLI sessions with empty or 'unknown' project
  const codexSessions = await db.query.sessions.findMany({
    where: eq(sessions.sourceType, 'codex-cli'),
  })

  console.log(`Found ${codexSessions.length} Codex CLI sessions`)

  let fixedCount = 0

  for (const session of codexSessions) {
    const needsFix = !session.project || session.project === 'unknown' || !session.projectName || session.projectName === 'unknown'

    if (!needsFix) {
      continue
    }

    // Find raw files for this session
    const sourcePaths = session.sourceFilePaths?.split(',').filter(Boolean) || []

    for (const filePath of sourcePaths) {
      // Look for session data files (not history.jsonl or session_index.jsonl)
      if (filePath.includes('sessions/')) {
        const rawFile = await db.query.rawFiles.findFirst({
          where: and(
            eq(rawFiles.filePath, filePath),
            eq(rawFiles.sourceType, 'codex-cli'),
          ),
        })

        if (rawFile?.content) {
          const metaMap = extractSessionMetaFromContent(rawFile.content)
          const meta = metaMap.get(session.sessionId)

          if (meta && (meta.cwd || meta.threadName)) {
            const newProject = meta.cwd || ''
            const newProjectName = meta.cwd ? meta.cwd.split('/').pop() : ''
            const newDisplay = meta.threadName || session.display

            await db.update(sessions)
              .set({
                project: newProject,
                projectName: newProjectName,
                display: newDisplay,
                updatedAt: new Date(),
              })
              .where(eq(sessions.id, session.id))

            console.log(`Fixed session ${session.sessionId}: project="${newProject}", projectName="${newProjectName}", display="${newDisplay}"`)
            fixedCount++
            break
          }
        }
      }
    }
  }

  console.log(`\nFixed ${fixedCount} sessions`)
}

fixCodexSessions().catch(console.error)
