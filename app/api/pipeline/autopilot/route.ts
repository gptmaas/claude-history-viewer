import { NextRequest } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'
import { generateForStage } from '@/lib/ai/pipeline-generate'
import { GENERATE_LABELS, type GenerateType } from '@/lib/ai/prompts'
import { PIPELINE_STAGES } from '@/lib/pipeline-types'
import type { PipelineRisk } from '@/lib/pipeline-types'

export const dynamic = 'force-dynamic'

interface StagePlan {
  stageKey: string
  stageTitle: string
  steps: GenerateType[]
  reviewAfter?: GenerateType
}

const AUTOPILOT_PLAN: StagePlan[] = [
  {
    stageKey: 'idea',
    stageTitle: '需求想法',
    steps: ['requirement'],
  },
  {
    stageKey: 'product_design_review',
    stageTitle: '方案设计与评审',
    steps: ['product_design', 'product_review'],
    reviewAfter: 'product_review',
  },
  {
    stageKey: 'technical_design_review',
    stageTitle: '技术方案与评审',
    steps: ['technical_design', 'task_breakdown', 'tech_review', 'test_plan'],
    reviewAfter: 'tech_review',
  },
]

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { itemId } = body as { itemId: number }

  if (!itemId) {
    return new Response(JSON.stringify({ error: 'itemId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ds = getPipelineDataSource()
  const item = await ds.getItem(itemId)
  if (!item) {
    return new Response(JSON.stringify({ error: 'Item not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        for (const plan of AUTOPILOT_PLAN) {
          // Find the stage for this plan
          const stage = item.stages.find(s => s.stageKey === plan.stageKey)
          if (!stage) continue

          // Skip already passed stages
          if (stage.status === 'passed' || stage.status === 'skipped') continue

          send('stage_start', { stageKey: plan.stageKey, stageTitle: plan.stageTitle })

          // Start the stage
          try {
            await ds.transitionStage(stage.id, 'start')
          } catch {
            // Already started, that's fine
          }

          let stopped = false

          for (const genType of plan.steps) {
            const label = GENERATE_LABELS[genType]
            send('generating', { generateType: genType, label })

            try {
              const result = await generateForStage(itemId, plan.stageKey, genType)

              // Save artifact
              await ds.addArtifact(stage.id, result.artifactName, result.artifactType, result.content)

              // Save review if applicable
              if (result.isReview && result.reviewResult) {
                await ds.addReview(stage.id, result.reviewResult, result.content, 'auto')
              }

              send('generated', {
                generateType: genType,
                artifactName: result.artifactName,
                preview: result.content.slice(0, 200),
              })

              // Check review result
              if (plan.reviewAfter === genType && result.isReview) {
                const risks = result.risks ?? []
                const hasHighRisk = risks.some(r => r.level === 'P0' || r.level === 'P1')

                send('review_result', {
                  result: result.reviewResult,
                  risks,
                })

                if (result.reviewResult !== 'approved' || hasHighRisk) {
                  const reason = result.reviewResult !== 'approved'
                    ? 'review_failed'
                    : 'high_risk'
                  const riskMsg = hasHighRisk
                    ? risks.filter(r => r.level === 'P0' || r.level === 'P1').map(r => `${r.level}: ${r.message}`).join('; ')
                    : ''
                  const message = result.reviewResult !== 'approved'
                    ? `评审未通过${riskMsg ? '，风险：' + riskMsg : ''}`
                    : `评审通过但存在高风险：${riskMsg}`

                  send('stopped', { reason, stageKey: plan.stageKey, message, risks })
                  stopped = true
                  break
                }
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Generation failed'
              send('error', { stageKey: plan.stageKey, generateType: genType, message: msg })
              stopped = true
              break
            }
          }

          if (stopped) break

          // Advance stage
          try {
            await ds.transitionStage(stage.id, 'advance')
          } catch {
            // Try request_review then approve
            try {
              await ds.transitionStage(stage.id, 'request_review')
              await ds.transitionStage(stage.id, 'approve')
            } catch {
              // skip
            }
          }

          send('stage_passed', { stageKey: plan.stageKey })

          // Refresh item data for next stage
          const updatedItem = await ds.getItem(itemId)
          if (updatedItem) {
            item.stages = updatedItem.stages
          }
        }

        send('completed', { message: '全部 AI 可执行阶段已完成' })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Auto pilot failed'
        send('error', { message: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
