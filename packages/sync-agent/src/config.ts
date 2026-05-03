import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir, hostname, userInfo } from 'os'
import { createHash } from 'crypto'

const CONFIG_DIR = join(homedir(), '.claude-sync')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')
const MACHINE_ID_FILE = join(CONFIG_DIR, 'machine-id')

export interface SyncConfig {
  serverUrl: string
  apiKey: string
  claudeDir: string
  syncInterval: number // seconds
  machineId: string
}

export function loadConfig(): SyncConfig | null {
  if (!existsSync(CONFIG_FILE)) return null
  try {
    const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
    // Auto-generate machineId for configs that don't have one
    if (!config.machineId) {
      config.machineId = getOrCreateMachineId()
      saveConfig(config)
    }
    return config
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

export function getOrCreateMachineId(): string {
  if (existsSync(MACHINE_ID_FILE)) {
    return readFileSync(MACHINE_ID_FILE, 'utf-8').trim()
  }
  const raw = `${hostname()}:${userInfo().username}`
  const id = createHash('sha256').update(raw).digest('hex').slice(0, 16)
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
  writeFileSync(MACHINE_ID_FILE, id)
  return id
}
