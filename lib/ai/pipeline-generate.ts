import { getPipelineDataSource } from '@/lib/pipeline-data-source'
import { generateText, getProjectDir } from '@/lib/ai/client'
import { getPromptBuilder, GENERATE_META, type GenerateType, type PromptContext } from '@/lib/ai/prompts'
import { scanProject } from '@/lib/ai/repo-scanner'
import type { PipelineRisk, PipelineRiskLevel } from '@/lib/pipeline-types'

export interface GenerateResult {
  content: string
  artifactName: string
  artifactType: string
  isReview: boolean
  reviewResult?: string
  risks?: PipelineRisk[]
}

export async function generateForStage(
  itemId: number,
  stageKey: string,
  generateType: GenerateType,
  context?: { sessionExcerpt?: string; manualNotes?: string }
): Promise<GenerateResult> {
  const ds = getPipelineDataSource()
  const item = await ds.getItem(itemId)
  if (!item) throw new Error('Item not found')

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
    } catch {
      promptContext.repoContext = '(项目扫描失败)'
    }
  }

  const builder = getPromptBuilder(generateType)
  const { system, user } = builder(promptContext)
  const content = await generateText(system, user, { maxTokens: 8192 })

  const meta = GENERATE_META[generateType]
  const result: GenerateResult = {
    content,
    artifactName: meta.artifactName,
    artifactType: meta.artifactType,
    isReview: meta.isReview,
  }

  if (meta.isReview) {
    const approved = content.includes('approved') || content.includes('通过')
    result.reviewResult = approved ? 'approved' : 'needs_changes'
    result.risks = extractRisks(content)
  }

  return result
}

export function extractRisks(content: string): PipelineRisk[] {
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
