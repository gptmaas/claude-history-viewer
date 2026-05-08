import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { rawFiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { validateApiKey, extractBearerToken } from '@/lib/auth-server'
import { parseAllPendingRawFiles } from '@/lib/raw-file-parser'

interface RawFilePayload {
  filePath: string
  content: string
  contentHash: string
  mtime: string
  size: number
}

interface SyncPayload {
  machineId: string
  machineName?: string
  files: RawFilePayload[]
}

export async function POST(request: NextRequest) {
  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const authResult = await validateApiKey(token)
  if (!authResult) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  const userId = authResult.userId

  try {
    const body: SyncPayload = await request.json()
    const { machineId, machineName, files } = body

    if (!machineId || !Array.isArray(files)) {
      return NextResponse.json({ error: 'Invalid payload: machineId and files required' }, { status: 400 })
    }

    const db = getDb()
    let acceptedFiles = 0
    let skippedFiles = 0

    // Store raw files (upsert by user+machine+path)
    for (const file of files) {
      const existing = await db.query.rawFiles.findFirst({
        where: and(
          eq(rawFiles.userId, userId),
          eq(rawFiles.machineId, machineId),
          eq(rawFiles.filePath, file.filePath),
        ),
      })

      if (existing && existing.contentHash === file.contentHash) {
        skippedFiles++
        continue
      }

      const lineCount = file.content.trim().split('\n').filter(Boolean).length

      if (existing) {
        await db.update(rawFiles)
          .set({
            content: file.content,
            contentHash: file.contentHash,
            fileSize: file.size,
            lineCount,
            mtime: file.mtime ? new Date(file.mtime) : null,
            parsedAt: null,
            parseVersion: 0,
            updatedAt: new Date(),
          })
          .where(eq(rawFiles.id, existing.id))
      } else {
        await db.insert(rawFiles).values({
          userId,
          machineId,
          machineName: machineName || '',
          filePath: file.filePath,
          content: file.content,
          contentHash: file.contentHash,
          fileSize: file.size,
          lineCount,
          mtime: file.mtime ? new Date(file.mtime) : null,
        })
      }
      acceptedFiles++
    }

    // Trigger parsing for newly stored files
    const parseResult = await parseAllPendingRawFiles(userId, machineId, machineName)

    return NextResponse.json({
      success: true,
      acceptedFiles,
      skippedFiles,
      totalFiles: files.length,
      parseResult,
    })
  } catch (error) {
    console.error('Error syncing data:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}
