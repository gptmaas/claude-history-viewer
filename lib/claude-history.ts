import { readFile, readdir, access } from 'fs/promises'
import { join } from 'path'
import type {
  SessionListEntry,
  Session,
  SessionDetail,
  Message,
  SearchResult,
  ExportFormat,
} from './types'
import type { SourceConfig } from './desktop-config'

// Default Claude Code history location
const DEFAULT_CLAUDE_DIR = join(process.env.HOME || '', '.claude')

interface SourceDir {
  type: string
  path: string
}

/**
 * Get the Claude directory path (can be overridden by env var)
 */
function getClaudeDir(): string {
  return process.env.CLAUDE_DIR || DEFAULT_CLAUDE_DIR
}

/**
 * Get configured source directories.
 * In local-desktop mode, reads from desktop config.
 * Otherwise, returns the single default Claude dir.
 */
let cachedSources: SourceDir[] | null = null

export function resetSourceCache(): void {
  cachedSources = null
}

async function getSourceDirs(): Promise<SourceDir[]> {
  if (cachedSources) return cachedSources

  if (process.env.DATA_SOURCE_MODE === 'local-desktop') {
    const { loadDesktopConfig, detectDefaultSources } = require('./desktop-config') as typeof import('./desktop-config')
    const config = await loadDesktopConfig()
    if (config && config.sources.length > 0) {
      cachedSources = config.sources
        .filter((s: SourceConfig) => s.enabled)
        .map((s: SourceConfig) => ({ type: s.type, path: s.path }))
      return cachedSources
    }
    // No config yet, try auto-detect
    const detected = await detectDefaultSources()
    if (detected.length > 0) {
      cachedSources = detected.map((s: SourceConfig) => ({ type: s.type, path: s.path }))
      return cachedSources
    }
  }

  cachedSources = [{ type: 'claude-code', path: getClaudeDir() }]
  return cachedSources
}

/**
 * Parse a project path to extract readable name
 */
function parseProjectName(projectPath: string | undefined): string {
  if (!projectPath) return 'unknown'
  const parts = projectPath.split('/')
  const name = parts[parts.length - 1] || projectPath
  return name
}

/**
 * Convert timestamp to Date
 */
function timestampToDate(timestamp: number): Date {
  return new Date(timestamp)
}

/**
 * Read and parse the history.jsonl file from a single source directory
 */
async function loadSessionsFromSource(sourceDir: SourceDir): Promise<Session[]> {
  const historyPath = join(sourceDir.path, 'history.jsonl')

  try {
    await access(historyPath)
  } catch {
    return []
  }

  const content = await readFile(historyPath, 'utf-8')
  const lines = content.trim().split('\n').filter(Boolean)

  const entries: SessionListEntry[] = []
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as SessionListEntry
      entries.push(entry)
    } catch {
      // Skip invalid lines
    }
  }

  return entries.map((entry) => ({
    ...entry,
    projectName: parseProjectName(entry.project),
    date: timestampToDate(entry.timestamp),
    sourceType: sourceDir.type,
  }))
}

/**
 * Read and parse sessions from all configured source directories
 */
export async function loadSessionsList(): Promise<Session[]> {
  const sourceDirs = await getSourceDirs()
  const allSessions: Session[] = []

  for (const sourceDir of sourceDirs) {
    const sessions = await loadSessionsFromSource(sourceDir)
    allSessions.push(...sessions)
  }

  // Deduplicate by sessionId, keeping the entry with the latest timestamp
  const sessionMap = new Map<string, Session>()
  for (const session of allSessions) {
    const existing = sessionMap.get(session.sessionId)
    if (!existing || session.timestamp > existing.timestamp) {
      sessionMap.set(session.sessionId, session)
    }
  }

  return Array.from(sessionMap.values()).sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Find the project directory for a given session across all source directories
 */
async function findSessionProjectDir(sessionId: string): Promise<string | null> {
  const sourceDirs = await getSourceDirs()

  for (const sourceDir of sourceDirs) {
    const projectsDir = join(sourceDir.path, 'projects')

    try {
      await access(projectsDir)
    } catch {
      continue
    }

    const dirs = await readdir(projectsDir, { withFileTypes: true })

    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const sessionPath = join(projectsDir, dir.name, `${sessionId}.jsonl`)
        try {
          await access(sessionPath)
          return join(projectsDir, dir.name)
        } catch {
          // Session not in this directory
        }
      }
    }
  }

  return null
}

/**
 * Extract text content from a message content field
 * Handles both string content and array content (with thinking blocks)
 */
function extractContent(content: unknown): string | unknown {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    // Return the array as-is for specialized rendering
    return content
  }
  if (typeof content === 'object' && content !== null) {
    // Preserve thinking blocks and other structured content
    return content
  }
  return ''
}

/**
 * Load detailed messages for a specific session
 */
export async function loadSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const projectDir = await findSessionProjectDir(sessionId)
  if (!projectDir) {
    return null
  }

  const sessionPath = join(projectDir, `${sessionId}.jsonl`)

  try {
    const content = await readFile(sessionPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    const messages: Message[] = []
    for (const line of lines) {
      try {
        const msg = JSON.parse(line)

        // Skip file history snapshots
        if (msg.type === 'file-history-snapshot') {
          continue
        }

        // Handle different message types based on the actual data structure
        if (msg.type === 'user') {
          // Check if this is a tool result (not actual user input)
          const content = msg.message?.content
          const isToolResult =
            Array.isArray(content) &&
            content.length > 0 &&
            content[0]?.type === 'tool_result'

          if (isToolResult) {
            // Skip tool results or store them separately if needed
            continue
          }

          // Real user message
          const rawContent = msg.message?.content || msg.content
          messages.push({
            type: 'user',
            role: 'user',
            content: extractContent(rawContent),
            uuid: msg.uuid,
            sessionId: msg.sessionId || sessionId,
            timestamp: msg.timestamp,
            cwd: msg.cwd,
            gitBranch: msg.gitBranch,
          })
        } else if (msg.message && msg.message.role === 'assistant') {
          // Assistant message (detected by message.role)
          const rawContent = msg.message?.content || msg.content
          messages.push({
            type: 'assistant',
            role: 'assistant',
            content: extractContent(rawContent),
            uuid: msg.uuid || msg.message?.id,
            sessionId: msg.sessionId || sessionId,
            timestamp: msg.timestamp,
          })
        } else if (msg.type === 'tool_use') {
          // Tool use message
          messages.push({
            type: 'tool_use',
            content: msg.content || JSON.stringify(msg),
            uuid: msg.uuid || msg.id,
            sessionId: msg.sessionId || sessionId,
            timestamp: msg.timestamp,
          })
        } else if (msg.type === 'tool_result') {
          // Tool result message
          messages.push({
            type: 'tool_result',
            content: msg.content || msg.result || JSON.stringify(msg),
            uuid: msg.uuid || msg.id,
            sessionId: msg.sessionId || sessionId,
            timestamp: msg.timestamp,
          })
        }
      } catch {
        // Skip invalid messages
      }
    }

    // Find session info from history
    const sessions = await loadSessionsList()
    const sessionInfo = sessions.find((s) => s.sessionId === sessionId)

    if (!sessionInfo) {
      return null
    }

    return {
      session: sessionInfo,
      messages,
      projectPath: projectDir,
    }
  } catch {
    return null
  }
}

/**
 * Convert content to string for search/export
 */
function contentToString(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
      .map((block) => block.text)
      .join('\n\n')
  }
  if (typeof content === 'object' && content !== null) {
    if ('type' in content && content.type === 'thinking' && 'thinking' in content) {
      return String(content.thinking)
    }
    return JSON.stringify(content)
  }
  return ''
}

/**
 * Search for sessions matching a keyword
 */
export async function searchSessions(keyword: string): Promise<SearchResult[]> {
  const sessions = await loadSessionsList()
  const results: SearchResult[] = []

  const lowerKeyword = keyword.toLowerCase()

  for (const session of sessions) {
    const matchedMessages: SearchResult['matchedMessages'] = []

    // Check if title/description matches
    if (session.display.toLowerCase().includes(lowerKeyword)) {
      results.push({
        session,
        matchedMessages: [],
        relevanceScore: 1.0,
      })
      continue
    }

    // Check messages
    const detail = await loadSessionDetail(session.sessionId)
    if (detail) {
      for (const msg of detail.messages) {
        if ('content' in msg) {
          const content = contentToString(msg.content)
          if (content.toLowerCase().includes(lowerKeyword)) {
            // Find highlight ranges
            const highlights: Array<{ start: number; end: number }> = []
            let index = 0
            while ((index = content.toLowerCase().indexOf(lowerKeyword, index)) !== -1) {
              highlights.push({ start: index, end: index + keyword.length })
              index += keyword.length
            }

            // Create snippet (context around match)
            const firstMatch = highlights[0]
            const start = Math.max(0, firstMatch.start - 50)
            const end = Math.min(content.length, firstMatch.end + 50)
            const snippet = (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '')

            matchedMessages.push({
              message: msg,
              snippet,
              highlightRanges: highlights.map((h) => ({
                start: h.start - start,
                end: h.end - start,
              })),
            })
          }
        }
      }

      if (matchedMessages.length > 0) {
        results.push({
          session,
          matchedMessages,
          relevanceScore: matchedMessages.length,
        })
      }
    }
  }

  // Sort by relevance
  results.sort((a, b) => b.relevanceScore - a.relevanceScore)

  return results
}

/**
 * Export a session to the specified format
 */
export async function exportSession(sessionId: string, format: ExportFormat): Promise<string | null> {
  const detail = await loadSessionDetail(sessionId)
  if (!detail) {
    return null
  }

  switch (format) {
    case 'md':
      return exportToMarkdown(detail)
    case 'json':
      return JSON.stringify(detail, null, 2)
    case 'html':
      return exportToHTML(detail)
    default:
      return null
  }
}

/**
 * Export session to Markdown format
 */
function exportToMarkdown(detail: SessionDetail): string {
  const { session, messages } = detail
  let md = `# ${session.display}\n\n`
  md += `**Project:** ${session.project}\n`
  md += `**Date:** ${session.date.toLocaleString()}\n`
  md += `**Session ID:** ${session.sessionId}\n\n`
  md += `---\n\n`

  for (const msg of messages) {
    if (msg.type === 'user') {
      md += `## 👤 User\n\n${contentToString(msg.content)}\n\n`
    } else if (msg.type === 'assistant') {
      md += `## 🤖 Assistant\n\n${contentToString(msg.content)}\n\n`
    } else if (msg.type === 'tool_use') {
      md += `## 🔧 Tool Use\n\n\`\`\`json\n${contentToString(msg.content)}\n\`\`\`\n\n`
    } else if (msg.type === 'tool_result') {
      md += `## 📋 Tool Result\n\n\`\`\`\n${contentToString(msg.content)}\n\`\`\`\n\n`
    }
  }

  return md
}

/**
 * Export session to HTML format
 */
function exportToHTML(detail: SessionDetail): string {
  const { session, messages } = detail

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.display)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
    .message { margin: 20px 0; padding: 15px; border-radius: 8px; }
    .user { background: #e3f2fd; }
    .assistant { background: #f5f5f5; }
    .tool { background: #fff3e0; font-size: 14px; }
    .role { font-weight: bold; margin-bottom: 8px; }
    pre { background: #263238; color: #aed581; padding: 15px; border-radius: 6px; overflow-x: auto; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(session.display)}</h1>
  <div class="meta">
    <strong>Project:</strong> ${escapeHtml(session.project)}<br>
    <strong>Date:</strong> ${session.date.toLocaleString()}<br>
    <strong>Session ID:</strong> ${session.sessionId}
  </div>
  <hr>
`

  for (const msg of messages) {
    if (msg.type === 'user') {
      html += `<div class="message user">
        <div class="role">👤 User</div>
        <div>${formatContent(msg.content)}</div>
      </div>`
    } else if (msg.type === 'assistant') {
      html += `<div class="message assistant">
        <div class="role">🤖 Assistant</div>
        <div>${formatContent(msg.content)}</div>
      </div>`
    } else if (msg.type === 'tool_use') {
      html += `<div class="message tool">
        <div class="role">🔧 Tool Use</div>
        <div>${formatContent(msg.content)}</div>
      </div>`
    } else if (msg.type === 'tool_result') {
      html += `<div class="message tool">
        <div class="role">📋 Tool Result</div>
        <div>${formatContent(msg.content)}</div>
      </div>`
    }
  }

  html += `</body></html>`
  return html
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function formatContent(content: string | unknown): string {
  // Convert to string first
  const textContent = contentToString(content)
  // Simple code block detection
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  let result = escapeHtml(textContent)
  result = result.replace(codeBlockRegex, '<pre><code>$2</code></pre>')
  return result
}
