import type { PipelineStageStatus, PipelineTransition } from './pipeline-types'
import { PIPELINE_STAGE_IDS } from './pipeline-types'
import { isValidTransition, applyTransition } from './pipeline-state-machine'
import type {
  PipelineProject,
  PipelineItem,
  PipelineStageRow,
  PipelineArtifact,
  PipelineReview,
  PipelineEvent,
  PipelineSessionLink,
  PipelineItemDetail,
  PipelineStageDetail,
  CreatePipelineItemInput,
  PipelineDashboard,
} from './pipeline-data'
import { getDb, getRawDb } from './local-db/index'
import {
  pipelineProjects,
  pipelineItems,
  pipelineStages,
  pipelineArtifacts,
  pipelineReviews,
  pipelineEvents,
  pipelineSessionLinks,
} from './local-db/schema'
import { eq, and, desc, count, isNull } from 'drizzle-orm'

export interface PipelineDataSource {
  listProjects(): Promise<PipelineProject[]>
  createProject(name: string, description?: string): Promise<PipelineProject>
  getProject(id: number): Promise<PipelineProject | null>
  updateProject(id: number, data: Partial<Pick<PipelineProject, 'name' | 'description' | 'status'>>): Promise<void>

  listItems(projectId: number): Promise<PipelineItem[]>
  createItem(data: CreatePipelineItemInput): Promise<PipelineItem>
  getItem(id: number): Promise<PipelineItemDetail | null>
  updateItem(id: number, data: Partial<Pick<PipelineItem, 'title' | 'background' | 'goals' | 'acceptanceCriteria' | 'priority' | 'overallStatus'>>): Promise<void>

  getStagesForItem(itemId: number): Promise<PipelineStageRow[]>
  transitionStage(stageId: number, transition: PipelineTransition, detail?: Record<string, unknown>): Promise<PipelineStageRow>

  addArtifact(stageId: number, name: string, artifactType: string, content: string): Promise<PipelineArtifact>
  listArtifacts(stageId: number): Promise<PipelineArtifact[]>
  updateArtifact(id: number, content: string): Promise<void>
  deleteArtifact(id: number): Promise<void>

  addReview(stageId: number, result: string, comment?: string, reviewerType?: string): Promise<PipelineReview>
  listReviews(stageId: number): Promise<PipelineReview[]>

  getEventsForItem(itemId: number): Promise<PipelineEvent[]>

  addSessionLink(itemId: number, stageId: number | null, sessionId: string, linkType: string, note?: string): Promise<PipelineSessionLink>
  getSessionLinksForItem(itemId: number): Promise<PipelineSessionLink[]>
  getSessionLinksForStage(stageId: number): Promise<PipelineSessionLink[]>
  getSessionLinksForSession(sessionId: string): Promise<PipelineSessionLink[]>
  removeSessionLink(id: number): Promise<void>

  getPipelineDashboard(): Promise<PipelineDashboard>
}

export class SqlitePipelineDataSource implements PipelineDataSource {
  private db() { return getDb() }
  private raw() { return getRawDb() }

  // --- Projects ---

  async listProjects(): Promise<PipelineProject[]> {
    return this.db().query.pipelineProjects.findMany({
      orderBy: [desc(pipelineProjects.createdAt)],
    }) as Promise<PipelineProject[]>
  }

  async createProject(name: string, description?: string): Promise<PipelineProject> {
    const now = Date.now()
    const result = await this.db().insert(pipelineProjects).values({
      name,
      description: description ?? null,
      status: 'active',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    }).returning()
    return result[0] as PipelineProject
  }

  async getProject(id: number): Promise<PipelineProject | null> {
    const result = await this.db().query.pipelineProjects.findFirst({
      where: eq(pipelineProjects.id, id),
    })
    return (result as PipelineProject) ?? null
  }

  async updateProject(id: number, data: Partial<Pick<PipelineProject, 'name' | 'description' | 'status'>>): Promise<void> {
    const updates: Record<string, unknown> = { ...data, updatedAt: new Date() }
    await this.db().update(pipelineProjects).set(updates).where(eq(pipelineProjects.id, id))
  }

  // --- Items ---

  async listItems(projectId: number): Promise<PipelineItem[]> {
    return this.db().query.pipelineItems.findMany({
      where: eq(pipelineItems.projectId, projectId),
      orderBy: [desc(pipelineItems.createdAt)],
    }) as Promise<PipelineItem[]>
  }

  async createItem(data: CreatePipelineItemInput): Promise<PipelineItem> {
    const now = Date.now()
    const raw = this.raw()

    const txn = raw.transaction(() => {
      // Insert item
      const itemResult = raw.prepare(
        `INSERT INTO pipeline_items (project_id, title, background, goals, acceptance_criteria, current_stage_index, overall_status, priority, source_session_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, 'in_progress', ?, ?, ?, ?)`
      ).run(
        data.projectId,
        data.title,
        data.background ?? null,
        data.goals ? JSON.stringify(data.goals) : null,
        data.acceptanceCriteria ? JSON.stringify(data.acceptanceCriteria) : null,
        data.priority ?? 'P2',
        data.sourceSessionId ?? null,
        now,
        now,
      )
      const itemId = itemResult.lastInsertRowid as number

      // Insert 7 stages
      const stageStmt = raw.prepare(
        `INSERT INTO pipeline_stages (item_id, stage_key, stage_index, status, updated_at) VALUES (?, ?, ?, 'not_started', ?)`
      )
      for (let i = 0; i < PIPELINE_STAGE_IDS.length; i++) {
        stageStmt.run(itemId, PIPELINE_STAGE_IDS[i], i, now)
      }

      // Insert creation event
      raw.prepare(
        `INSERT INTO pipeline_events (item_id, transition, from_status, to_status, detail, created_at) VALUES (?, 'create_item', NULL, 'created', NULL, ?)`
      ).run(itemId, now)

      // Read back the item
      const item = raw.prepare('SELECT * FROM pipeline_items WHERE id = ?').get(itemId) as PipelineItem
      return item
    })()

    return txn
  }

  async getItem(id: number): Promise<PipelineItemDetail | null> {
    const item = await this.db().query.pipelineItems.findFirst({
      where: eq(pipelineItems.id, id),
    }) as PipelineItem | undefined
    if (!item) return null

    const stages = await this.getStagesForItem(item.id)
    const stagesWithDetails: PipelineStageDetail[] = []
    for (const stage of stages) {
      const [artifacts, reviews] = await Promise.all([
        this.listArtifacts(stage.id),
        this.listReviews(stage.id),
      ])
      stagesWithDetails.push({ ...stage, artifacts, reviews })
    }

    return { ...item, stages: stagesWithDetails }
  }

  async updateItem(id: number, data: Partial<Pick<PipelineItem, 'title' | 'background' | 'goals' | 'acceptanceCriteria' | 'priority' | 'overallStatus'>>): Promise<void> {
    const updates: Record<string, unknown> = {}
    if (data.title !== undefined) updates.title = data.title
    if (data.background !== undefined) updates.background = data.background
    if (data.goals !== undefined) updates.goals = JSON.stringify(data.goals)
    if (data.acceptanceCriteria !== undefined) updates.acceptanceCriteria = JSON.stringify(data.acceptanceCriteria)
    if (data.priority !== undefined) updates.priority = data.priority
    if (data.overallStatus !== undefined) updates.overallStatus = data.overallStatus
    updates.updatedAt = new Date()

    await this.db().update(pipelineItems).set(updates).where(eq(pipelineItems.id, id))
  }

  // --- Stages ---

  async getStagesForItem(itemId: number): Promise<PipelineStageRow[]> {
    return this.db().query.pipelineStages.findMany({
      where: eq(pipelineStages.itemId, itemId),
      orderBy: [pipelineStages.stageIndex],
    }) as Promise<PipelineStageRow[]>
  }

  async transitionStage(stageId: number, transition: PipelineTransition, detail?: Record<string, unknown>): Promise<PipelineStageRow> {
    const raw = this.raw()
    const now = Date.now()

    const result = raw.transaction(() => {
      // Read current stage
      const stage = raw.prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(stageId) as PipelineStageRow | undefined
      if (!stage) throw new Error(`Stage ${stageId} not found`)

      const fromStatus = stage.status as PipelineStageStatus

      // Validate transition
      if (!isValidTransition(fromStatus, transition)) {
        throw new Error(`Invalid transition '${transition}' from status '${fromStatus}'`)
      }

      const toStatus = applyTransition(fromStatus, transition)

      // Update stage
      const updates: Record<string, unknown> = {
        status: toStatus,
        updated_at: now,
      }
      if (transition === 'start' && !stage.startedAt) {
        updates.started_at = now
      }
      if (['approve', 'advance', 'auto_pass', 'skip'].includes(transition)) {
        updates.completed_at = now
      }
      if (transition === 'rollback') {
        updates.started_at = null
        updates.completed_at = null
      }

      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
      raw.prepare(`UPDATE pipeline_stages SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), stageId)

      // If stage passed, advance the item's currentStageIndex
      if (['approve', 'advance', 'auto_pass'].includes(transition)) {
        const item = raw.prepare('SELECT * FROM pipeline_items WHERE id = ?').get(stage.itemId) as PipelineItem | undefined
        if (item && stage.stageIndex === item.currentStageIndex) {
          const nextIndex = stage.stageIndex + 1
          // Skip over already-skipped stages
          let targetIndex = nextIndex
          const allStages = raw.prepare('SELECT stage_index, status FROM pipeline_stages WHERE item_id = ? ORDER BY stage_index').all(stage.itemId) as Array<{ stage_index: number; status: string }>
          while (targetIndex < allStages.length && allStages[targetIndex].status === 'skipped') {
            targetIndex++
          }
          raw.prepare('UPDATE pipeline_items SET current_stage_index = ?, updated_at = ? WHERE id = ?').run(targetIndex, now, stage.itemId)

          // If all stages passed/skipped, mark item as completed
          if (targetIndex >= allStages.length) {
            raw.prepare("UPDATE pipeline_items SET overall_status = 'completed', updated_at = ? WHERE id = ?").run(now, stage.itemId)
          }
        }
      }

      // If rollback on a passed stage, move item back
      if (transition === 'rollback' && stage.stageIndex < (raw.prepare('SELECT current_stage_index FROM pipeline_items WHERE id = ?').get(stage.itemId) as { current_stage_index: number }).current_stage_index) {
        raw.prepare('UPDATE pipeline_items SET current_stage_index = ?, overall_status = ?, updated_at = ? WHERE id = ?').run(stage.stageIndex, 'in_progress', now, stage.itemId)
      }

      // Insert event
      raw.prepare(
        `INSERT INTO pipeline_events (item_id, stage_id, transition, from_status, to_status, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(stage.itemId, stageId, transition, fromStatus, toStatus, detail ? JSON.stringify(detail) : null, now)

      // Read back
      return raw.prepare('SELECT * FROM pipeline_stages WHERE id = ?').get(stageId) as PipelineStageRow
    })()

    return result
  }

  // --- Artifacts ---

  async addArtifact(stageId: number, name: string, artifactType: string, content: string): Promise<PipelineArtifact> {
    const now = Date.now()
    const result = await this.db().insert(pipelineArtifacts).values({
      stageId,
      name,
      artifactType,
      content,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    }).returning()

    // Log event
    const stage = await this.db().query.pipelineStages.findFirst({ where: eq(pipelineStages.id, stageId) })
    if (stage) {
      await this.db().insert(pipelineEvents).values({
        itemId: stage.itemId,
        stageId,
        transition: 'submit_artifact',
        fromStatus: stage.status,
        toStatus: stage.status,
        detail: { artifactName: name },
        createdAt: new Date(now),
      })
    }

    return result[0] as PipelineArtifact
  }

  async listArtifacts(stageId: number): Promise<PipelineArtifact[]> {
    return this.db().query.pipelineArtifacts.findMany({
      where: eq(pipelineArtifacts.stageId, stageId),
      orderBy: [desc(pipelineArtifacts.createdAt)],
    }) as Promise<PipelineArtifact[]>
  }

  async updateArtifact(id: number, content: string): Promise<void> {
    await this.db().update(pipelineArtifacts).set({ content, updatedAt: new Date() }).where(eq(pipelineArtifacts.id, id))
  }

  async deleteArtifact(id: number): Promise<void> {
    await this.db().delete(pipelineArtifacts).where(eq(pipelineArtifacts.id, id))
  }

  // --- Reviews ---

  async addReview(stageId: number, result: string, comment?: string, reviewerType?: string): Promise<PipelineReview> {
    const now = Date.now()
    const review = await this.db().insert(pipelineReviews).values({
      stageId,
      result,
      comment: comment ?? null,
      reviewerType: reviewerType ?? 'user',
      createdAt: new Date(now),
    }).returning()

    // Log event
    const stage = await this.db().query.pipelineStages.findFirst({ where: eq(pipelineStages.id, stageId) })
    if (stage) {
      await this.db().insert(pipelineEvents).values({
        itemId: stage.itemId,
        stageId,
        transition: 'submit_review',
        fromStatus: stage.status,
        toStatus: stage.status,
        detail: { reviewResult: result },
        createdAt: new Date(now),
      })
    }

    return review[0] as PipelineReview
  }

  async listReviews(stageId: number): Promise<PipelineReview[]> {
    return this.db().query.pipelineReviews.findMany({
      where: eq(pipelineReviews.stageId, stageId),
      orderBy: [desc(pipelineReviews.createdAt)],
    }) as Promise<PipelineReview[]>
  }

  // --- Events ---

  async getEventsForItem(itemId: number): Promise<PipelineEvent[]> {
    return this.db().query.pipelineEvents.findMany({
      where: eq(pipelineEvents.itemId, itemId),
      orderBy: [desc(pipelineEvents.createdAt)],
    }) as Promise<PipelineEvent[]>
  }

  // --- Session Links ---

  async addSessionLink(itemId: number, stageId: number | null, sessionId: string, linkType: string, note?: string): Promise<PipelineSessionLink> {
    const result = await this.db().insert(pipelineSessionLinks).values({
      itemId,
      stageId,
      sessionId,
      linkType,
      note: note ?? null,
      createdAt: new Date(),
    }).returning()
    return result[0] as PipelineSessionLink
  }

  async getSessionLinksForItem(itemId: number): Promise<PipelineSessionLink[]> {
    return this.db().query.pipelineSessionLinks.findMany({
      where: eq(pipelineSessionLinks.itemId, itemId),
      orderBy: [desc(pipelineSessionLinks.createdAt)],
    }) as Promise<PipelineSessionLink[]>
  }

  async getSessionLinksForStage(stageId: number): Promise<PipelineSessionLink[]> {
    return this.db().query.pipelineSessionLinks.findMany({
      where: eq(pipelineSessionLinks.stageId, stageId),
      orderBy: [desc(pipelineSessionLinks.createdAt)],
    }) as Promise<PipelineSessionLink[]>
  }

  async getSessionLinksForSession(sessionId: string): Promise<PipelineSessionLink[]> {
    return this.db().query.pipelineSessionLinks.findMany({
      where: eq(pipelineSessionLinks.sessionId, sessionId),
      orderBy: [desc(pipelineSessionLinks.createdAt)],
    }) as Promise<PipelineSessionLink[]>
  }

  async removeSessionLink(id: number): Promise<void> {
    await this.db().delete(pipelineSessionLinks).where(eq(pipelineSessionLinks.id, id))
  }

  // --- Dashboard ---

  async getPipelineDashboard(): Promise<PipelineDashboard> {
    const raw = this.raw()

    const counts = raw.prepare(`
      SELECT
        SUM(CASE WHEN overall_status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN overall_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN overall_status = 'abandoned' THEN 1 ELSE 0 END) as abandoned
      FROM pipeline_items
    `).get() as { in_progress: number; completed: number; abandoned: number }

    const stageCounts = raw.prepare(`
      SELECT
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked,
        SUM(CASE WHEN status = 'waiting_review' THEN 1 ELSE 0 END) as waiting_review
      FROM pipeline_stages
    `).get() as { blocked: number; waiting_review: number }

    const recentEvents = raw.prepare(`
      SELECT * FROM pipeline_events ORDER BY created_at DESC LIMIT 20
    `).all() as PipelineEvent[]

    return {
      inProgressCount: counts.in_progress ?? 0,
      completedCount: counts.completed ?? 0,
      abandonedCount: counts.abandoned ?? 0,
      blockedCount: stageCounts.blocked ?? 0,
      waitingReviewCount: stageCounts.waiting_review ?? 0,
      recentEvents: recentEvents.map(e => ({
        ...e,
        detail: typeof e.detail === 'string' ? JSON.parse(e.detail) : e.detail,
      })),
    }
  }
}

let pipelineDS: SqlitePipelineDataSource | null = null

export function getPipelineDataSource(): PipelineDataSource {
  if (!pipelineDS) {
    pipelineDS = new SqlitePipelineDataSource()
  }
  return pipelineDS
}
