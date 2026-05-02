import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const CONFIG_DIR = join(homedir(), '.claude-sync')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

export interface SyncConfig {
  serverUrl: string
  apiKey: string
  claudeDir: string
  syncInterval: number // seconds
}

export function loadConfig(): SyncConfig | null {
  if (!existsSync(CONFIG_FILE)) return null
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    return null
  }
}

export function saveConfig(config: SyncConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

export function getDefaultClaudeDir(): string {
  return join(homedir(), '.claude')
}
