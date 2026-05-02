import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface SessionListEntry {
  display: string
  timestamp: number
  project: string
  sessionId: string
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

export function parseProjectName(projectPath: string): string {
  const parts = projectPath.split('/')
  return parts[parts.length - 1] || projectPath
}

export function parseHistoryFile(claudeDir: string): ParsedSession[] {
  const historyPath = join(claudeDir, 'history.jsonl')
  if (!existsSync(historyPath)) return []

  const content = readFileSync(historyPath, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)

  const entries: SessionListEntry[] = []
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line))
    } catch {}
  }

  // Deduplicate
  const sessionMap = new Map<string, SessionListEntry>()
  for (const entry of entries) {
    const existing = sessionMap.get(entry.sessionId)
    if (!existing || entry.timestamp > existing.timestamp) {
      sessionMap.set(entry.sessionId, entry)
    }
  }

  return Array.from(sessionMap.values()).map((entry) => ({
    sessionId: entry.sessionId,
    display: entry.display,
    project: entry.project,
    projectName: parseProjectName(entry.project),
    messageCount: 0,
    timestamp: entry.timestamp,
  }))
}

export function parseSessionFile(claudeDir: string, sessionId: string, projectPath: string): ParsedMessage[] {
  const sessionPath = join(claudeDir, 'projects', projectPath, `${sessionId}.jsonl`)
  if (!existsSync(sessionPath)) return []

  const content = readFileSync(sessionPath, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)

  const messages: ParsedMessage[] = []
  for (const line of lines) {
    try {
      const msg = JSON.parse(line)
      if (msg.type === 'file-history-snapshot') continue

      if (msg.type === 'user') {
        const rawContent = msg.message?.content
        const isToolResult = Array.isArray(rawContent) && rawContent[0]?.type === 'tool_result'
        if (isToolResult) continue

        messages.push({
          type: 'user',
          role: 'user',
          content: rawContent || msg.content,
          uuid: msg.uuid,
          sessionId: msg.sessionId || sessionId,
          timestamp: msg.timestamp,
        })
      } else if (msg.message?.role === 'assistant') {
        messages.push({
          type: 'assistant',
          role: 'assistant',
          content: msg.message?.content || msg.content,
          uuid: msg.uuid || msg.message?.id,
          sessionId: msg.sessionId || sessionId,
          timestamp: msg.timestamp,
        })
      } else if (msg.type === 'tool_use') {
        messages.push({
          type: 'tool_use',
          content: msg.content || JSON.stringify(msg),
          uuid: msg.uuid || msg.id,
          sessionId: msg.sessionId || sessionId,
          timestamp: msg.timestamp,
        })
      } else if (msg.type === 'tool_result') {
        messages.push({
          type: 'tool_result',
          content: msg.content || msg.result || JSON.stringify(msg),
          uuid: msg.uuid || msg.id,
          sessionId: msg.sessionId || sessionId,
          timestamp: msg.timestamp,
        })
      }
    } catch {}
  }

  return messages
}

export function findSessionProjectDirs(claudeDir: string): string[] {
  const projectsDir = join(claudeDir, 'projects')
  if (!existsSync(projectsDir)) return []

  const { readdirSync } = require('fs')
  return readdirSync(projectsDir, { withFileTypes: true })
    .filter((d: { isDirectory: () => boolean }) => d.isDirectory())
    .map((d: { name: string }) => d.name)
}
