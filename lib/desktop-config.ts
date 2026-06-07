import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'

export interface SourceConfig {
  type: 'claude-code' | 'codex-cli'
  path: string
  enabled: boolean
}

export interface DesktopConfig {
  mode: 'local-desktop'
  sources: SourceConfig[]
  lastOpenedAt: string | null
}

const CONFIG_FILENAME = 'desktop-config.json'

export function getConfigDir(): string {
  return process.env.DESKTOP_CONFIG_DIR || join(process.env.HOME || '', '.codememory')
}

export function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILENAME)
}

export async function loadDesktopConfig(): Promise<DesktopConfig | null> {
  const configPath = getConfigPath()
  try {
    await access(configPath)
    const content = await readFile(configPath, 'utf-8')
    return JSON.parse(content) as DesktopConfig
  } catch {
    return null
  }
}

export async function saveDesktopConfig(config: DesktopConfig): Promise<void> {
  const configDir = getConfigDir()
  await mkdir(configDir, { recursive: true })
  config.lastOpenedAt = new Date().toISOString()
  await writeFile(join(configDir, CONFIG_FILENAME), JSON.stringify(config, null, 2), 'utf-8')
}

export async function detectDefaultSources(): Promise<SourceConfig[]> {
  const sources: SourceConfig[] = []
  const home = process.env.HOME || ''
  if (!home) return sources

  const candidates = [
    { type: 'claude-code' as const, path: join(home, '.claude') },
    { type: 'codex-cli' as const, path: join(home, '.codex') },
  ]

  for (const { type, path } of candidates) {
    try {
      await access(path)
      sources.push({ type, path, enabled: true })
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return sources
}

export async function validateSourceDir(dirPath: string): Promise<SourceConfig | null> {
  try {
    await access(dirPath)

    // Check for Claude Code markers (history.jsonl)
    try {
      await access(join(dirPath, 'history.jsonl'))
      return { type: 'claude-code', path: dirPath, enabled: true }
    } catch {}

    // Check for Claude Code projects directory
    try {
      await access(join(dirPath, 'projects'))
      return { type: 'claude-code', path: dirPath, enabled: true }
    } catch {}

    // Check for Codex CLI markers
    // TODO: Add Codex-specific detection when parser is ready

    // Default to claude-code if the directory exists
    return { type: 'claude-code', path: dirPath, enabled: true }
  } catch {
    return null
  }
}
