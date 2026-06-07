import { getDb } from '../lib/db/index.js'
import { rawFiles, syncState, messages } from '../lib/db/schema.js'
import { eq, and, sql } from 'drizzle-orm'
import { getParser } from '../lib/parsers/registry.js'

const CURRENT_PARSE_VERSION = 2
const BATCH_SIZE = 10

async function main() {
  const db = getDb()
  const states = await db.select().from(syncState)
  console.log(`Found ${states.length} sync states`)

  for (const s of states) {
    console.log(`\nProcessing user=${s.userId}, machine=${s.machineId}, source=${s.sourceType}`)

    let offset = 0
    let totalUpdated = 0
    let totalFiles = 0
    while (true) {
      const files = await db.execute<{
        id: string
        file_path: string
        content: string
        source_type: string
      }>(sql`
        SELECT id, file_path, content, source_type
        FROM raw_files
        WHERE user_id = ${s.userId}
          AND machine_id = ${s.machineId}
          AND (parsed_at IS NULL OR parse_version < ${CURRENT_PARSE_VERSION})
        ORDER BY file_path
        LIMIT ${BATCH_SIZE} OFFSET ${offset}
      `)

      const batch = Array.from(files)
      if (batch.length === 0) break

      console.log(`  Batch at offset ${offset}: ${batch.length} files`)

      for (const file of batch) {
        try {
          const parser = getParser(file.source_type)
          if (!parser) continue

          const messagesBySession = parser.parseSessionData(file.content)
          let fileUpdated = 0

          for (const [, msgs] of messagesBySession) {
            for (const m of msgs) {
              if (!m.uuid || !m.model) continue

              const usageJson = m.usage ? JSON.stringify(m.usage) : null
              await db.execute(sql`
                UPDATE messages
                SET model = COALESCE(model, ${m.model}),
                    usage = COALESCE(usage, ${usageJson}::jsonb)
                WHERE uuid = ${m.uuid} AND model IS NULL
              `)
              fileUpdated++
            }
          }

          await db.execute(sql`
            UPDATE raw_files
            SET parse_version = ${CURRENT_PARSE_VERSION}, parsed_at = NOW()
            WHERE id = ${file.id}
          `)

          totalUpdated += fileUpdated
          totalFiles++
          if (fileUpdated > 0) console.log(`    ${file.file_path}: ${fileUpdated} msgs`)
        } catch (e: any) {
          console.error(`    Error in ${file.file_path}: ${e.message?.slice(0, 100)}`)
        }
      }

      offset += BATCH_SIZE
    }
    console.log(`  Total: ${totalFiles} files, ${totalUpdated} messages updated`)
  }

  console.log('\nDone!')
  process.exit(0)
}

main()
