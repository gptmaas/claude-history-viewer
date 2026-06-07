import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { join } from 'path'
import { mkdirSync } from 'fs'
import * as schema from './schema'

const DB_DIR = process.env.DESKTOP_CONFIG_DIR || join(process.env.HOME || '', '.codememory')
const DB_PATH = join(DB_DIR, 'local.db')

let rawDb: Database.Database | null = null
let db: ReturnType<typeof drizzle<typeof schema>> | null = null

function ensureDir() {
  mkdirSync(DB_DIR, { recursive: true })
}

export function getRawDb(): Database.Database {
  if (!rawDb) {
    ensureDir()
    rawDb = new Database(DB_PATH)
    rawDb.pragma('journal_mode = WAL')
    rawDb.pragma('foreign_keys = ON')
  }
  return rawDb
}

export function getDb() {
  if (!db) {
    db = drizzle(getRawDb(), { schema })
  }
  return db
}

export function closeDb() {
  if (db) {
    db = null
  }
  if (rawDb) {
    rawDb.close()
    rawDb = null
  }
}

export function getDbPath(): string {
  return DB_PATH
}
