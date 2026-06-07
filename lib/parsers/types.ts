export interface ParsedSession {
  sessionId: string
  display: string
  project: string
  projectName: string
  messageCount: number
  timestamp: number
}

export interface MessageUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
}

export interface ParsedMessage {
  type: string
  role?: string
  content: unknown
  uuid: string
  sessionId: string
  timestamp?: string
  // Optional session metadata extracted during message parsing
  project?: string
  projectName?: string
  display?: string
  // Model and usage fields (extracted from assistant messages)
  model?: string
  usage?: MessageUsage
}

export interface RawFileParser {
  readonly name: string
  parseHistoryIndex(content: string): Map<string, ParsedSession>
  parseSessionData(content: string): Map<string, ParsedMessage[]>
}
