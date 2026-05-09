import { readdirSync, statSync, existsSync } from 'fs'
import { join, extname, relative } from 'path'
import { homedir } from 'os'
import type { ConversationSource, DiscoveredFile } from './types'

export class CodexCLISource implements ConversationSource {
  readonly name = 'codex-cli'
  readonly label = 'Codex CLI'
  readonly watchDir: string

  constructor(baseDir?: string) {
    this.watchDir = baseDir ?? join(homedir(), '.codex')
  }

  discoverFiles(): DiscoveredFile[] {
    const files: DiscoveredFile[] = []

    // history.jsonl
    const historyPath = join(this.watchDir, 'history.jsonl')
    if (existsSync(historyPath)) {
      const stat = statSync(historyPath)
      files.push({
        relativePath: 'history.jsonl',
        absolutePath: historyPath,
        mtime: stat.mtimeMs,
        size: stat.size,
      })
    }

    // session_index.jsonl
    const indexPath = join(this.watchDir, 'session_index.jsonl')
    if (existsSync(indexPath)) {
      const stat = statSync(indexPath)
      files.push({
        relativePath: 'session_index.jsonl',
        absolutePath: indexPath,
        mtime: stat.mtimeMs,
        size: stat.size,
      })
    }

    // sessions/**/*.jsonl
    const sessionsDir = join(this.watchDir, 'sessions')
    if (existsSync(sessionsDir)) {
      collectJsonl(sessionsDir, this.watchDir, files)
    }

    return files
  }
}

function collectJsonl(dir: string, baseDir: string, result: DiscoveredFile[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectJsonl(fullPath, baseDir, result)
    } else if (extname(entry.name) === '.jsonl') {
      const stat = statSync(fullPath)
      result.push({
        relativePath: relative(baseDir, fullPath),
        absolutePath: fullPath,
        mtime: stat.mtimeMs,
        size: stat.size,
      })
    }
  }
}
