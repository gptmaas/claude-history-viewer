import type { DiscoveredFile } from './sources/types'
import { ClaudeCodeSource } from './sources/claude-code'
import type { ConversationSource } from './sources/types'

export type { DiscoveredFile }
export type { ConversationSource }

export function scanAllJsonlFiles(claudeDir: string): DiscoveredFile[] {
  // Backwards-compatible: single claudeDir creates a ClaudeCodeSource
  const source = new ClaudeCodeSource(claudeDir)
  return source.discoverFiles()
}

export function scanSources(sources: ConversationSource[]): Array<{ sourceType: string; files: DiscoveredFile[] }> {
  return sources.map(source => ({
    sourceType: source.name,
    files: source.discoverFiles(),
  }))
}
