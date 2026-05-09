import type { RawFileParser, ParsedSession, ParsedMessage } from './types'

export class ClaudeCodeParser implements RawFileParser {
  readonly name = 'claude-code'

  parseHistoryIndex(content: string): Map<string, ParsedSession> {
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

  parseSessionData(content: string): Map<string, ParsedMessage[]> {
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
}

function parseProjectName(projectPath: string): string {
  const parts = projectPath.split('/')
  return parts[parts.length - 1] || projectPath
}
