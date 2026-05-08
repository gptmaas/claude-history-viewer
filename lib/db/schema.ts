import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull(),
  keyPrefix: varchar('key_prefix', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull().default('default'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_api_keys_user_id').on(table.userId),
  index('idx_api_keys_key_hash').on(table.keyHash),
])

export const rawFiles = pgTable('raw_files', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  machineId: varchar('machine_id', { length: 64 }).notNull(),
  machineName: varchar('machine_name', { length: 255 }).notNull().default(''),
  filePath: text('file_path').notNull(),
  contentHash: varchar('content_hash', { length: 64 }).notNull(),
  content: text('content').notNull(),
  fileSize: integer('file_size'),
  lineCount: integer('line_count'),
  mtime: timestamp('mtime', { withTimezone: true }),
  parsedAt: timestamp('parsed_at', { withTimezone: true }),
  parseVersion: integer('parse_version').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_raw_files_user_machine_path').on(table.userId, table.machineId, table.filePath),
  index('idx_raw_files_unparsed').on(table.parsedAt).where(sql`parsed_at IS NULL`),
])

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  machineId: varchar('machine_id', { length: 64 }),
  machineName: varchar('machine_name', { length: 255 }),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  display: text('display').notNull(),
  project: text('project').notNull(),
  projectName: varchar('project_name', { length: 255 }).notNull(),
  messageCount: integer('message_count').default(0),
  sourceFilePaths: text('source_file_paths'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_sessions_user_session').on(table.userId, table.sessionId),
  index('idx_sessions_user_id').on(table.userId),
  index('idx_sessions_started_at').on(table.startedAt),
  index('idx_sessions_project').on(table.project),
  index('idx_sessions_machine_id').on(table.machineId),
])

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  role: varchar('role', { length: 50 }),
  content: jsonb('content').notNull(),
  uuid: varchar('uuid', { length: 255 }),
  timestamp: timestamp('timestamp', { withTimezone: true }),
  metadata: jsonb('metadata'),
  searchVector: text('search_vector'),
}, (table) => [
  index('idx_messages_session_id').on(table.sessionId),
  index('idx_messages_user_id').on(table.userId),
  uniqueIndex('idx_messages_uuid').on(table.uuid),
])

export const syncState = pgTable('sync_state', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  machineId: varchar('machine_id', { length: 64 }),
  machineName: varchar('machine_name', { length: 255 }),
  sourceType: varchar('source_type', { length: 50 }).notNull().default('claude-code'),
  sourcePath: text('source_path'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  syncCursor: text('sync_cursor'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_sync_state_user_id').on(table.userId),
  uniqueIndex('idx_sync_state_user_source').on(table.userId, table.sourceType, table.machineId),
])
