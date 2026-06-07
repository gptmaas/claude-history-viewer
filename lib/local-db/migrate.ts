import { getRawDb } from './index'

const CURRENT_VERSION = 2

const MIGRATIONS: Record<number, string[]> = {
  1: [
    // schema_version
    `CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )`,

    // local_sources
    `CREATE TABLE IF NOT EXISTS local_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_scan_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_local_sources_path ON local_sources(path)`,

    // local_raw_files
    `CREATE TABLE IF NOT EXISTS local_raw_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES local_sources(id),
      path TEXT NOT NULL,
      mtime INTEGER NOT NULL,
      size INTEGER NOT NULL,
      hash TEXT,
      parse_version INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_local_raw_files_source_path ON local_raw_files(source_id, path)`,
    `CREATE INDEX IF NOT EXISTS idx_local_raw_files_status ON local_raw_files(status)`,

    // local_sessions
    `CREATE TABLE IF NOT EXISTS local_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES local_sources(id),
      session_id TEXT NOT NULL,
      display TEXT,
      project TEXT,
      project_name TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER NOT NULL,
      last_message_at INTEGER,
      first_message_at INTEGER,
      duration_seconds INTEGER,
      source_type TEXT NOT NULL DEFAULT 'claude-code',
      source_file_paths TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_local_sessions_session_id ON local_sessions(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_local_sessions_source_id ON local_sessions(source_id)`,
    `CREATE INDEX IF NOT EXISTS idx_local_sessions_started_at ON local_sessions(started_at)`,
    `CREATE INDEX IF NOT EXISTS idx_local_sessions_project ON local_sessions(project)`,
    `CREATE INDEX IF NOT EXISTS idx_local_sessions_source_type ON local_sessions(source_type)`,

    // local_messages
    `CREATE TABLE IF NOT EXISTS local_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES local_sessions(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      role TEXT,
      content TEXT,
      uuid TEXT,
      timestamp INTEGER,
      model TEXT,
      usage TEXT,
      search_text TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_local_messages_session_id ON local_messages(session_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_local_messages_uuid ON local_messages(uuid)`,
    `CREATE INDEX IF NOT EXISTS idx_local_messages_model ON local_messages(model)`,
    `CREATE INDEX IF NOT EXISTS idx_local_messages_type ON local_messages(type)`,
    `CREATE INDEX IF NOT EXISTS idx_local_messages_timestamp ON local_messages(timestamp)`,

    // local_projects
    `CREATE TABLE IF NOT EXISTS local_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES local_sources(id),
      project TEXT NOT NULL,
      project_name TEXT NOT NULL,
      session_count INTEGER NOT NULL DEFAULT 0,
      last_activity_at INTEGER NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_local_projects_source_project ON local_projects(source_id, project)`,

    // local_index_runs
    `CREATE TABLE IF NOT EXISTS local_index_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES local_sources(id),
      status TEXT NOT NULL DEFAULT 'running',
      files_total INTEGER NOT NULL DEFAULT 0,
      files_parsed INTEGER NOT NULL DEFAULT 0,
      files_failed INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      error_message TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_local_index_runs_source_id ON local_index_runs(source_id)`,

    // FTS5 virtual table for message search
    `CREATE VIRTUAL TABLE IF NOT EXISTS local_messages_fts USING fts5(
      search_text,
      content='local_messages',
      content_rowid='id'
    )`,

    // FTS5 triggers to keep index in sync
    `CREATE TRIGGER IF NOT EXISTS local_messages_ai AFTER INSERT ON local_messages BEGIN
      INSERT INTO local_messages_fts(rowid, search_text) VALUES (new.id, COALESCE(new.search_text, ''));
    END`,
    `CREATE TRIGGER IF NOT EXISTS local_messages_ad AFTER DELETE ON local_messages BEGIN
      INSERT INTO local_messages_fts(local_messages_fts, rowid, search_text) VALUES('delete', old.id, COALESCE(old.search_text, ''));
    END`,
    `CREATE TRIGGER IF NOT EXISTS local_messages_au AFTER UPDATE ON local_messages BEGIN
      INSERT INTO local_messages_fts(local_messages_fts, rowid, search_text) VALUES('delete', old.id, COALESCE(old.search_text, ''));
      INSERT INTO local_messages_fts(rowid, search_text) VALUES (new.id, COALESCE(new.search_text, ''));
    END`,
  ],
  2: [
    `CREATE INDEX IF NOT EXISTS idx_local_messages_type ON local_messages(type)`,
    `CREATE INDEX IF NOT EXISTS idx_local_messages_timestamp ON local_messages(timestamp)`,
  ],
}

export function runMigrations(): void {
  const db = getRawDb()

  // Get current version
  let currentVersion = 0
  try {
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null } | undefined
    currentVersion = row?.v ?? 0
  } catch {
    // Table doesn't exist yet — will be created by migration 1
  }

  if (currentVersion >= CURRENT_VERSION) return

  for (let v = currentVersion + 1; v <= CURRENT_VERSION; v++) {
    const statements = MIGRATIONS[v]
    if (!statements) continue

    const transaction = db.transaction(() => {
      for (const sql of statements) {
        db.exec(sql)
      }
      db.prepare('INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)').run(v, Date.now())
    })
    transaction()
  }
}
