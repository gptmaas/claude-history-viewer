import { NextRequest, NextResponse } from 'next/server'
import { generateForStage } from '@/lib/ai/pipeline-generate'
import type { GenerateType } from '@/lib/ai/prompts'

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

    const result = await generateForStage(itemId, stageKey, generateType, context)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in pipeline generate:', error)
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
