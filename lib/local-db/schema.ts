import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const schemaVersion = sqliteTable('schema_version', {
  version: integer('version').primaryKey(),
  appliedAt: integer('applied_at', { mode: 'timestamp' }).notNull(),
})

export const localSources = sqliteTable('local_sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['claude-code', 'codex-cli'] }).notNull(),
  path: text('path').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastScanAt: integer('last_scan_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
}, (table) => [
  uniqueIndex('idx_local_sources_path').on(table.path),
])

export const localRawFiles = sqliteTable('local_raw_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => localSources.id),
  path: text('path').notNull(),
  mtime: integer('mtime').notNull(),
  size: integer('size').notNull(),
  hash: text('hash'),
  parseVersion: integer('parse_version').notNull().default(0),
  status: text('status', { enum: ['pending', 'parsed', 'failed', 'skipped'] }).notNull().default('pending'),
  errorMessage: text('error_message'),
}, (table) => [
  uniqueIndex('idx_local_raw_files_source_path').on(table.sourceId, table.path),
  index('idx_local_raw_files_status').on(table.status),
])

export const localSessions = sqliteTable('local_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => localSources.id),
  sessionId: text('session_id').notNull(),
  display: text('display'),
  project: text('project'),
  projectName: text('project_name'),
  messageCount: integer('message_count').notNull().default(0),
  startedAt: integer('started_at').notNull(),
  lastMessageAt: integer('last_message_at'),
  firstMessageAt: integer('first_message_at'),
  durationSeconds: integer('duration_seconds'),
  sourceType: text('source_type').notNull().default('claude-code'),
  sourceFilePaths: text('source_file_paths'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
}, (table) => [
  uniqueIndex('idx_local_sessions_session_id').on(table.sessionId),
  index('idx_local_sessions_source_id').on(table.sourceId),
  index('idx_local_sessions_started_at').on(table.startedAt),
  index('idx_local_sessions_project').on(table.project),
  index('idx_local_sessions_source_type').on(table.sourceType),
])

export const localMessages = sqliteTable('local_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => localSessions.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  role: text('role'),
  content: text('content', { mode: 'json' }),
  uuid: text('uuid'),
  timestamp: integer('timestamp'),
  model: text('model'),
  usage: text('usage', { mode: 'json' }),
  searchText: text('search_text'),
}, (table) => [
  index('idx_local_messages_session_id').on(table.sessionId),
  uniqueIndex('idx_local_messages_uuid').on(table.uuid),
  index('idx_local_messages_model').on(table.model),
  index('idx_local_messages_type').on(table.type),
  index('idx_local_messages_timestamp').on(table.timestamp),
])

export const localProjects = sqliteTable('local_projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => localSources.id),
  project: text('project').notNull(),
  projectName: text('project_name').notNull(),
  sessionCount: integer('session_count').notNull().default(0),
  lastActivityAt: integer('last_activity_at').notNull(),
}, (table) => [
  uniqueIndex('idx_local_projects_source_project').on(table.sourceId, table.project),
])

export const localIndexRuns = sqliteTable('local_index_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => localSources.id),
  status: text('status', { enum: ['running', 'completed', 'failed'] }).notNull().default('running'),
  filesTotal: integer('files_total').notNull().default(0),
  filesParsed: integer('files_parsed').notNull().default(0),
  filesFailed: integer('files_failed').notNull().default(0),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  errorMessage: text('error_message'),
}, (table) => [
  index('idx_local_index_runs_source_id').on(table.sourceId),
])
