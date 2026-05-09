import type { ConversationSource } from './types'
import { ClaudeCodeSource } from './claude-code'
import { CodexCLISource } from './codex-cli'
import { join } from 'path'
import { homedir } from 'os'

export type { ConversationSource, DiscoveredFile } from './types'
export { ClaudeCodeSource } from './claude-code'
export { CodexCLISource } from './codex-cli'

const SOURCE_FACTORIES: Record<string, new (baseDir?: string) => ConversationSource> = {
  'claude-code': ClaudeCodeSource,
  'codex-cli': CodexCLISource,
}

export function getAvailableSourceNames(): string[] {
  return Object.keys(SOURCE_FACTORIES)
}

export function getSourceLabel(name: string): string {
  const labels: Record<string, string> = {
    'claude-code': 'Claude Code',
    'codex-cli': 'Codex CLI',
  }
  return labels[name] ?? name
}

export function createSources(names: string[], dirs?: Record<string, string>): ConversationSource[] {
  return names
    .filter(name => name in SOURCE_FACTORIES)
    .map(name => {
      const SourceClass = SOURCE_FACTORIES[name]
      const baseDir = dirs?.[name]
      return new SourceClass(baseDir)
    })
}

export function getDefaultDir(name: string): string {
  const defaults: Record<string, string> = {
    'claude-code': join(homedir(), '.claude'),
    'codex-cli': join(homedir(), '.codex'),
  }
  return defaults[name] ?? ''
}
