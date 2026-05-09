import type { RawFileParser } from './types'
import { ClaudeCodeParser } from './claude-code'
import { CodexCliParser } from './codex-cli'

export type { RawFileParser, ParsedSession, ParsedMessage } from './types'

const parsers = new Map<string, RawFileParser>()

export function registerParser(parser: RawFileParser): void {
  parsers.set(parser.name, parser)
}

export function getParser(sourceType: string): RawFileParser | undefined {
  return parsers.get(sourceType)
}

export function getAllParserNames(): string[] {
  return Array.from(parsers.keys())
}

// Register built-in parsers
registerParser(new ClaudeCodeParser())
registerParser(new CodexCliParser())
