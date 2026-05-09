import { readdirSync, statSync, existsSync } from 'fs'
import { join, extname, relative } from 'path'
import { homedir } from 'os'
import type { ConversationSource, DiscoveredFile } from './types'

export class ClaudeCodeSource implements ConversationSource {
  readonly name = 'claude-code'
  readonly label = 'Claude Code'
  readonly watchDir: string

  constructor(baseDir?: string) {
    this.watchDir = baseDir ?? join(homedir(), '.claude')
  }

  discoverFiles(): DiscoveredFile[] {
    const files: DiscoveredFile[] = []

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

    const projectsDir = join(this.watchDir, 'projects')
    if (existsSync(projectsDir)) {
      collectJsonl(projectsDir, this.watchDir, files)
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
