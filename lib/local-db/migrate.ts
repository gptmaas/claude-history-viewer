import { getRawDb } from './index'

const CURRENT_VERSION = 4

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
  3: [
    // pipeline_projects
    `CREATE TABLE IF NOT EXISTS pipeline_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_projects_status ON pipeline_projects(status)`,

    // pipeline_items
    `CREATE TABLE IF NOT EXISTS pipeline_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES pipeline_projects(id),
      title TEXT NOT NULL,
      background TEXT,
      goals TEXT,
      acceptance_criteria TEXT,
      current_stage_index INTEGER NOT NULL DEFAULT 0,
      overall_status TEXT NOT NULL DEFAULT 'in_progress',
      priority TEXT NOT NULL DEFAULT 'P2',
      source_session_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_items_project_id ON pipeline_items(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_items_status ON pipeline_items(overall_status)`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_items_current_stage ON pipeline_items(current_stage_index)`,

    // pipeline_stages
    `CREATE TABLE IF NOT EXISTS pipeline_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES pipeline_items(id),
      stage_key TEXT NOT NULL,
      stage_index INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      started_at INTEGER,
      completed_at INTEGER,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_stages_item_id ON pipeline_stages(item_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_stages_item_stage ON pipeline_stages(item_id, stage_key)`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_stages_status ON pipeline_stages(status)`,

    // pipeline_artifacts
    `CREATE TABLE IF NOT EXISTS pipeline_artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stage_id INTEGER NOT NULL REFERENCES pipeline_stages(id),
      name TEXT NOT NULL,
      artifact_type TEXT NOT NULL DEFAULT 'markdown',
      content TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_artifacts_stage_id ON pipeline_artifacts(stage_id)`,

    // pipeline_reviews
    `CREATE TABLE IF NOT EXISTS pipeline_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stage_id INTEGER NOT NULL REFERENCES pipeline_stages(id),
      result TEXT NOT NULL,
      comment TEXT,
      reviewer_type TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_reviews_stage_id ON pipeline_reviews(stage_id)`,

    // pipeline_events
    `CREATE TABLE IF NOT EXISTS pipeline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES pipeline_items(id),
      stage_id INTEGER REFERENCES pipeline_stages(id),
      transition TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      detail TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_events_item_id ON pipeline_events(item_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_events_stage_id ON pipeline_events(stage_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_events_created_at ON pipeline_events(created_at)`,

    // pipeline_session_links
    `CREATE TABLE IF NOT EXISTS pipeline_session_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES pipeline_items(id),
      stage_id INTEGER REFERENCES pipeline_stages(id),
      session_id TEXT NOT NULL,
      link_type TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_session_links_item_id ON pipeline_session_links(item_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_session_links_session_id ON pipeline_session_links(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pipeline_session_links_stage_id ON pipeline_session_links(stage_id)`,
  ],
  4: [
    `CREATE TABLE IF NOT EXISTS ai_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      provider TEXT NOT NULL DEFAULT 'anthropic',
      api_key TEXT,
      base_url TEXT,
      model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6-20250627',
      is_active INTEGER NOT NULL DEFAULT 1,
      project_dir TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_config_is_active ON ai_config(is_active)`,
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
