# Monorepo Structure

CodeMemory now uses npm workspaces to support multiple product surfaces from one repository.

## Current Layout

```text
apps/
  web/              # Boundary marker for the current Next.js web app
  desktop/          # Target home for the Tauri desktop app
packages/
  core/             # Shared domain models and workflow primitives
  sync-agent/       # Local CLI sync agent
  local-engine/     # Target home for local desktop indexing/execution
  cloud-db/         # Target home for cloud DB/data-source code
docs/
```

The existing Next.js app still lives at the repository root for now:

```text
app/
components/
lib/
```

This is intentional. Moving the Next.js app requires coordinated changes to routing, aliases, Docker/PM2 deployment, Tauri startup, and static asset handling.

## Package Boundaries

### `packages/core`

Shared by local desktop, cloud web, and sync agent when possible.

Owns:

- Stable domain types
- Pipeline stage definitions
- Pipeline state-machine primitives
- Parser abstractions once migrated
- Export-independent domain helpers

Must not depend on:

- Next.js
- NextAuth
- PostgreSQL
- Tauri
- Node-only command execution unless isolated behind an interface

### `packages/local-engine`

Local desktop runtime.

Owns:

- Local source discovery
- Local file watching
- SQLite indexing
- Local search/statistics
- Local pipeline persistence
- Safe command/test execution

Must not depend on:

- Cloud auth
- Cloud API keys
- PostgreSQL-only behavior

### `packages/cloud-db`

Cloud backend persistence.

Owns:

- Drizzle schema and migrations
- PostgreSQL data source
- Cloud query helpers
- User/team isolation helpers

Must not depend on:

- Tauri
- SQLite
- Local shell execution

### `packages/sync-agent`

Local CLI sync service.

Owns:

- CLI config
- Source scanning for upload
- File hash cache
- Batch upload
- Daemon file watching

It may reuse `packages/core` parser abstractions later, but should stay independent from the desktop UI.

## Migration Order

1. Keep root Next.js app running unchanged.
2. Add shared domain code to `packages/core`.
3. Move parser abstractions into `packages/core` with compatibility re-exports from `lib/parsers`.
4. Extract local indexing into `packages/local-engine`.
5. Extract Drizzle schema/data source into `packages/cloud-db`.
6. Move Next.js app into `apps/web` only after deployment scripts and aliases are updated.
7. Add Tauri desktop shell under `apps/desktop`.

## Work Rules

- New shared workflow/domain logic goes into `packages/core`.
- New local desktop-only behavior goes into `packages/local-engine`.
- New cloud-only persistence/auth behavior stays in the web app or moves to `packages/cloud-db`.
- High-risk moves should keep compatibility re-export files during transition.
- Each change should be tagged mentally as `shared`, `local`, `cloud`, `sync-agent`, or `desktop`.
