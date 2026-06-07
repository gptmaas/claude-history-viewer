import { readdirSync, statSync, existsSync, readFileSync } from 'fs'
import { join, extname, relative } from 'path'
import { createHash } from 'crypto'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../local-db/index'
import { localSources, localRawFiles } from '../local-db/schema'

export interface DiscoveredFile {
  relativePath: string
  absolutePath: string
  mtime: number
  size: number
}

export interface ScanResult {
  sourceId: number
  sourceType: string
  sourcePath: string
  newFiles: DiscoveredFile[]
  changedFiles: Array<DiscoveredFile & { dbId: number }>
  unchangedFiles: Array<DiscoveredFile & { dbId: number }>
  deletedFileIds: number[]
}

function discoverJsonlFiles(sourcePath: string, sourceType: string): DiscoveredFile[] {
  const files: DiscoveredFile[] = []

  if (!existsSync(sourcePath)) return files

  if (sourceType === 'claude-code') {
    const historyPath = join(sourcePath, 'history.jsonl')
    if (existsSync(historyPath)) {
      const stat = statSync(historyPath)
      files.push({
        relativePath: 'history.jsonl',
        absolutePath: historyPath,
        mtime: stat.mtimeMs,
        size: stat.size,
      })
    }

    const projectsDir = join(sourcePath, 'projects')
    if (existsSync(projectsDir)) {
      collectJsonl(projectsDir, sourcePath, files)
    }
  } else if (sourceType === 'codex-cli') {
    const historyPath = join(sourcePath, 'history.jsonl')
    if (existsSync(historyPath)) {
      const stat = statSync(historyPath)
      files.push({ relativePath: 'history.jsonl', absolutePath: historyPath, mtime: stat.mtimeMs, size: stat.size })
    }

    const indexPath = join(sourcePath, 'session_index.jsonl')
    if (existsSync(indexPath)) {
      const stat = statSync(indexPath)
      files.push({ relativePath: 'session_index.jsonl', absolutePath: indexPath, mtime: stat.mtimeMs, size: stat.size })
    }

    const sessionsDir = join(sourcePath, 'sessions')
    if (existsSync(sessionsDir)) {
      collectJsonl(sessionsDir, sourcePath, files)
    }
  }

  return files
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

export function computeFileHash(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex')
}

export async function scanSource(sourceId: number): Promise<ScanResult> {
  const db = getDb()

  const source = await db.query.localSources.findFirst({
    where: eq(localSources.id, sourceId),
  })
  if (!source) throw new Error(`Source ${sourceId} not found`)

  const discovered = discoverJsonlFiles(source.path, source.type)
  const discoveredMap = new Map(discovered.map((f) => [f.relativePath, f]))

  const existing = await db.select().from(localRawFiles).where(eq(localRawFiles.sourceId, sourceId))
  const existingMap = new Map(existing.map((f) => [f.path, f]))

  const newFiles: DiscoveredFile[] = []
  const changedFiles: Array<DiscoveredFile & { dbId: number }> = []
  const unchangedFiles: Array<DiscoveredFile & { dbId: number }> = []
  const deletedFileIds: number[] = []

  for (const file of discovered) {
    const dbRecord = existingMap.get(file.relativePath)
    if (!dbRecord) {
      newFiles.push(file)
    } else if (file.mtime !== dbRecord.mtime || file.size !== dbRecord.size) {
      changedFiles.push({ ...file, dbId: dbRecord.id })
    } else {
      unchangedFiles.push({ ...file, dbId: dbRecord.id })
    }
  }

  for (const dbRecord of existing) {
    if (!discoveredMap.has(dbRecord.path)) {
      deletedFileIds.push(dbRecord.id)
    }
  }

  return {
    sourceId,
    sourceType: source.type,
    sourcePath: source.path,
    newFiles,
    changedFiles,
    unchangedFiles,
    deletedFileIds,
  }
}

export async function fullScan(): Promise<ScanResult[]> {
  const db = getDb()

  const sources = await db.select().from(localSources).where(eq(localSources.enabled, true))
  const results: ScanResult[] = []

  for (const source of sources) {
    try {
      const result = await scanSource(source.id)
      results.push(result)
    } catch (err) {
      console.error(`Failed to scan source ${source.id} (${source.path}):`, err)
    }
  }

  return results
}
