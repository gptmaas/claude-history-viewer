import { getDb } from '../lib/db'
import { rawFiles } from '../lib/db/schema'
import { eq } from 'drizzle-orm'

async function resetCodexFiles() {
  const db = getDb()

  // Reset all Codex CLI raw files to be re-parsed
  const codexFiles = await db.select({ id: rawFiles.id, filePath: rawFiles.filePath })
    .from(rawFiles)
    .where(eq(rawFiles.sourceType, 'codex-cli'))

  console.log(`Found ${codexFiles.length} Codex CLI raw files`)

  for (const file of codexFiles) {
    await db.update(rawFiles)
      .set({
        parsedAt: null,
        parseVersion: 0,
      })
      .where(eq(rawFiles.id, file.id))
    console.log(`Reset: ${file.filePath}`)
  }

  console.log(`\nReset ${codexFiles.length} files for re-parsing`)
}

resetCodexFiles().catch(console.error)
