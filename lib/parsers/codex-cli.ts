import { createHash } from 'crypto'
import type { RawFileParser, ParsedSession, ParsedMessage } from './types'

export class CodexCliParser implements RawFileParser {
  readonly name = 'codex-cli'

  parseHistoryIndex(content: string): Map<string, ParsedSession> {
    const lines = content.trim().split('\n').filter(Boolean)
    const result = new Map<string, ParsedSession>()

    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        // Determine file type by field names
        // session_index.jsonl has: id, thread_name, updated_at
        // history.jsonl has: session_id, ts, text (multiple entries per session)
        const isSessionIndex = 'id' in entry && 'thread_name' in entry
        const sessionId = entry.session_id || entry.id
        if (!sessionId) continue

        if (isSessionIndex) {
          // session_index.jsonl - one entry per session with proper metadata
          result.set(sessionId, {
            sessionId,
            display: entry.thread_name || 'Untitled Session',
            project: entry.cwd || '',
            projectName: entry.cwd?.split('/').pop() || '',
            messageCount: 0,
            timestamp: entry.updated_at ? new Date(entry.updated_at).getTime() : Date.now(),
          })
        } else {
          // history.jsonl - multiple entries per session, only use for timestamp if no session_index entry exists
          const existing = result.get(sessionId)
          if (!existing) {
            // No session_index entry yet, create minimal entry
            result.set(sessionId, {
              sessionId,
              display: entry.text?.slice(0, 50) || 'Untitled Session',
              project: '',
              projectName: '',
              messageCount: 0,
              timestamp: entry.ts ? entry.ts * 1000 : Date.now(),
            })
          }
          // If session_index entry exists, skip history.jsonl entry - it overwrites important metadata
        }
      } catch {}
    }

    return result
  }

  parseSessionData(content: string): Map<string, ParsedMessage[]> {
    const lines = content.trim().split('\n').filter(Boolean)
    const result = new Map<string, ParsedMessage[]>()
    let sessionId = ''
    let sessionCwd = ''
    let sessionDisplay = ''
    let msgIndex = 0

    for (const line of lines) {
      try {
        const record = JSON.parse(line)
        const type = record.type

        if (type === 'session_meta') {
          sessionId = record.payload?.id || ''
          sessionCwd = record.payload?.cwd || ''
          sessionDisplay = record.payload?.thread_name || ''
          // Store session metadata as a special "meta" message
          if (sessionId && sessionCwd) {
            const metaUuid = deterministicUuid(sessionId, 'meta', 0)
            const metaMsg: ParsedMessage = {
              type: 'meta',
              role: 'system',
              content: { cwd: sessionCwd, thread_name: sessionDisplay },
              uuid: metaUuid,
              sessionId,
              timestamp: record.timestamp,
              project: sessionCwd,
              projectName: sessionCwd.split('/').pop() || '',
              display: sessionDisplay,
            }
            result.set(sessionId, [metaMsg])
          }
          continue
        }

        if (type !== 'response_item') continue
        if (!sessionId) continue

        const payload = record.payload
        if (!payload) continue

        const payloadType = payload.type
        let parsed: ParsedMessage | null = null

        if (payloadType === 'message') {
          const role = payload.role
          // Skip developer/system messages
          if (role === 'developer') continue

          const uuid = deterministicUuid(sessionId, record.timestamp, msgIndex)
          const content = normalizeContent(payload.content, role)

          parsed = {
            type: role === 'user' ? 'user' : 'assistant',
            role: role,
            content,
            uuid,
            sessionId,
            timestamp: record.timestamp,
          }
        } else if (payloadType === 'function_call') {
          const uuid = deterministicUuid(sessionId, record.timestamp, msgIndex)
          parsed = {
            type: 'tool_use',
            role: 'assistant',
            content: {
              name: payload.name,
              arguments: payload.arguments,
              call_id: payload.call_id,
            },
            uuid,
            sessionId,
            timestamp: record.timestamp,
          }
        } else if (payloadType === 'function_call_output') {
          const uuid = deterministicUuid(sessionId, record.timestamp, msgIndex)
          parsed = {
            type: 'tool_result',
            role: 'tool',
            content: payload.output,
            uuid,
            sessionId,
            timestamp: record.timestamp,
          }
        }

        // Skip reasoning, etc.
        if (!parsed) continue

        msgIndex++
        if (!result.has(sessionId)) {
          result.set(sessionId, [])
        }
        result.get(sessionId)!.push(parsed)
      } catch {}
    }

    return result
  }
}

function deterministicUuid(sessionId: string, timestamp: string, index: number): string {
  const raw = `codex:${sessionId}:${timestamp}:${index}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

function normalizeContent(content: unknown, role: string): unknown {
  if (!Array.isArray(content)) return content

  // Convert Codex content blocks to a format compatible with our UI
  return content.map((block: { type?: string; text?: string; [key: string]: unknown }) => {
    if (block.type === 'input_text' || block.type === 'output_text') {
      return { type: 'text', text: block.text }
    }
    return block
  })
}
