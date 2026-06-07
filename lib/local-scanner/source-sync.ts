import { eq } from 'drizzle-orm'
import { getDb } from '../local-db/index'
import { localSources } from '../local-db/schema'
import { loadDesktopConfig, detectDefaultSources } from '../desktop-config'
import type { SourceConfig } from '../desktop-config'

export async function syncDesktopSources(): Promise<void> {
  const db = getDb()

  let sources: SourceConfig[]
  try {
    const config = await loadDesktopConfig()
    if (config && config.sources.length > 0) {
      sources = config.sources
    } else {
      sources = await detectDefaultSources()
    }
  } catch {
    sources = await detectDefaultSources()
  }

  const existing = await db.select().from(localSources)
  const existingByPath = new Map(existing.map((s) => [s.path, s]))

  for (const source of sources) {
    const dbSource = existingByPath.get(source.path)
    if (dbSource) {
      // Update existing if type or enabled changed
      if (dbSource.type !== source.type || dbSource.enabled !== source.enabled) {
        await db.update(localSources)
          .set({ type: source.type, enabled: source.enabled })
          .where(eq(localSources.id, dbSource.id))
      }
      existingByPath.delete(source.path)
    } else {
      // Insert new source
      await db.insert(localSources).values({
        type: source.type,
        path: source.path,
        enabled: source.enabled,
      })
    }
  }

  // Disable sources no longer in config (don't delete — they have data)
  for (const [, dbSource] of existingByPath) {
    await db.update(localSources)
      .set({ enabled: false })
      .where(eq(localSources.id, dbSource.id))
  }
}
