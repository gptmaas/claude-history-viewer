import { NextRequest, NextResponse } from 'next/server'
import { getPipelineDataSource } from '@/lib/pipeline-data-source'
import { generateText, getProjectDir } from '@/lib/ai/client'
import { getPromptBuilder, GENERATE_META, type GenerateType, type PromptContext } from '@/lib/ai/prompts'
import { scanProject } from '@/lib/ai/repo-scanner'
import type { PipelineRisk, PipelineRiskLevel } from '@/lib/pipeline-types'

export const dynamic = 'force-dynamic'

const VALID_STAGE_GENERATE: Record<string, GenerateType[]> = {
  idea: ['requirement'],
  product_design_review: ['product_design', 'product_review'],
  technical_design_review: ['technical_design', 'task_breakdown', 'tech_review', 'test_plan'],
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { itemId, stageKey, generateType, context } = body as {
      itemId: number
      stageKey: string
      generateType: GenerateType
      context?: { sessionExcerpt?: string; manualNotes?: string }
    }

    if (!itemId || !stageKey || !generateType) {
      return NextResponse.json({ error: 'itemId, stageKey, generateType are required' }, { status: 400 })
    }
    const validTypes = VALID_STAGE_GENERATE[stageKey]
    if (!validTypes || !validTypes.includes(generateType)) {
      return NextResponse.json({ error: `generateType '${generateType}' not valid for stage '${stageKey}'` }, { status: 400 })
    }

    const ds = getPipelineDataSource()
    const item = await ds.getItem(itemId)
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const priorArtifacts: PromptContext['priorArtifacts'] = []
    for (const stage of item.stages) {
      for (const artifact of stage.artifacts) {
        if (artifact.content) {
          priorArtifacts.push({
            stageKey: stage.stageKey,
            name: artifact.name,
            content: artifact.content,
          })
        }
      }
    }

    const promptContext: PromptContext = {
      itemTitle: item.title,
      itemBackground: item.background,
      itemGoals: item.goals,
      itemAcceptanceCriteria: item.acceptanceCriteria,
      sourceSessionExcerpt: context?.sessionExcerpt,
      manualNotes: context?.manualNotes,
      priorArtifacts,
    }

    if (stageKey === 'technical_design_review') {
      const projectDir = getProjectDir() || process.cwd()
      try {
        promptContext.repoContext = scanProject(projectDir)
      } catch (err) {
        console.error('Repo scan failed:', err)
        promptContext.repoContext = '(项目扫描失败)'
      }
    }

    const builder = getPromptBuilder(generateType)
    const { system, user } = builder(promptContext)
    const content = await generateText(system, user, { maxTokens: 8192 })

    const meta = GENERATE_META[generateType]
    const response: Record<string, unknown> = {
      content,
      artifactName: meta.artifactName,
      artifactType: meta.artifactType,
      isReview: meta.isReview,
    }

    if (meta.isReview) {
      const approved = content.includes('approved') || content.includes('通过')
      response.reviewResult = approved ? 'approved' : 'needs_changes'
      response.risks = extractRisks(content)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in pipeline generate:', error)
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function extractRisks(content: string): PipelineRisk[] {
  const risks: PipelineRisk[] = []
  const riskPattern = /\|\s*(P[0-3])\s*\|\s*([^|]+)\s*\|/g
  let match
  while ((match = riskPattern.exec(content)) !== null) {
    const level = match[1] as PipelineRiskLevel
    const message = match[2].trim()
    if (message) {
      risks.push({
        level,
        message,
        requiresHumanApproval: level === 'P0',
      })
    }
  }
  return risks
}
