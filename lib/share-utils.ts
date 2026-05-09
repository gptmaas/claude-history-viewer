import crypto from 'crypto'
import type { SessionDetail, Message } from './types'

export function generateSlug(): string {
  return crypto.randomBytes(16).toString('base64url')
}

interface SanitizedSession {
  display: string
  project: string
  projectName: string
  timestamp: number
  date: Date
  messageCount?: number
}

interface SanitizedShareDetail {
  session: SanitizedSession
  messages: Message[]
}

export function sanitizeSessionForShare(detail: SessionDetail): SanitizedShareDetail {
  const { session, messages } = detail

  const sanitizedSession: SanitizedSession = {
    display: session.display,
    project: session.project,
    projectName: session.projectName,
    timestamp: session.timestamp,
    date: session.date,
    messageCount: session.messageCount,
  }

  const sanitizedMessages = messages.map((msg) => {
    if (msg.type === 'tool_use' || msg.type === 'tool_result') {
      return {
        ...msg,
        content: sanitizeContent(msg.content),
      }
    }
    if (msg.type === 'user') {
      return {
        ...msg,
        content: sanitizeContent(msg.content),
        ...(msg.cwd ? { cwd: undefined } : {}),
      }
    }
    return msg
  })

  return { session: sanitizedSession, messages: sanitizedMessages }
}

function sanitizeContent(content: unknown): unknown {
  if (typeof content === 'string') {
    return redactSensitiveStrings(content)
  }
  if (Array.isArray(content)) {
    return content.map(sanitizeContent)
  }
  if (typeof content === 'object' && content !== null) {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(content as Record<string, unknown>)) {
      if (isFilePathKey(key)) {
        sanitized[key] = truncatePath(String(value))
      } else {
        sanitized[key] = sanitizeContent(value)
      }
    }
    return sanitized
  }
  return content
}

function isFilePathKey(key: string): boolean {
  const pathKeys = ['file_path', 'filePath', 'path', 'file', 'fileName', 'directory', 'dir', 'cwd']
  return pathKeys.includes(key)
}

function truncatePath(filePath: string): string {
  const parts = filePath.split('/')
  return parts[parts.length - 1] || filePath
}

function redactSensitiveStrings(text: string): string {
  // Redact API key patterns
  let result = text
  result = result.replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-[REDACTED]')
  result = result.replace(/key_[a-zA-Z0-9]{20,}/g, 'key_[REDACTED]')
  result = result.replace(/token_[a-zA-Z0-9]{20,}/g, 'token_[REDACTED]')

  // Redact env var assignments with secret-looking values
  result = result.replace(
    /([A-Z_][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|AUTH|API)[A-Z0-9_]*)\s*=\s*[^\s\n"]+/gi,
    '$1=[REDACTED]'
  )

  return result
}
