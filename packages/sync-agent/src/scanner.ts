import { readdirSync, statSync, existsSync } from 'fs'
import { join, extname, relative } from 'path'

export interface DiscoveredFile {
  relativePath: string
  absolutePath: string
  mtime: number
  size: number
}

export function scanAllJsonlFiles(claudeDir: string): DiscoveredFile[] {
  const files: DiscoveredFile[] = []

  // Include history.jsonl
  const historyPath = join(claudeDir, 'history.jsonl')
  if (existsSync(historyPath)) {
    const stat = statSync(historyPath)
    files.push({
      relativePath: 'history.jsonl',
      absolutePath: historyPath,
      mtime: stat.mtimeMs,
      size: stat.size,
    })
  }

  // Recursively scan projects/ directory
  const projectsDir = join(claudeDir, 'projects')
  if (existsSync(projectsDir)) {
    collectJsonl(projectsDir, claudeDir, files)
  }

  return files
}

function collectJsonl(dir: string, claudeDir: string, result: DiscoveredFile[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      collectJsonl(fullPath, claudeDir, result)
    } else if (extname(entry.name) === '.jsonl') {
      const stat = statSync(fullPath)
      result.push({
        relativePath: relative(claudeDir, fullPath),
        absolutePath: fullPath,
        mtime: stat.mtimeMs,
        size: stat.size,
      })
    }
  }
}
