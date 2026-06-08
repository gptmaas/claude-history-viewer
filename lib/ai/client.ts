import Anthropic from '@anthropic-ai/sdk'
import { getRawDb } from '@/lib/local-db/index'

export interface GenerateOptions {
  maxTokens?: number
  temperature?: number
}

interface AiConfigRow {
  id: number
  name: string
  description: string | null
  provider: string
  api_key: string | null
  base_url: string | null
  model: string
  is_active: number
  project_dir: string | null
}

function getActiveConfig(): AiConfigRow | null {
  const db = getRawDb()
  return db.prepare('SELECT * FROM ai_config WHERE is_active = 1 LIMIT 1').get() as AiConfigRow | null
}

export function getAnthropicClient(): Anthropic {
  const config = getActiveConfig()
  if (!config?.api_key) {
    throw new Error('No active AI configuration found. Please configure an API key in Settings.')
  }
  return new Anthropic({
    apiKey: config.api_key,
    ...(config.base_url ? { baseURL: config.base_url } : {}),
  })
}

export function getActiveModel(): string {
  const config = getActiveConfig()
  return config?.model ?? 'claude-sonnet-4-6-20250627'
}

export async function generateText(systemPrompt: string, userPrompt: string, options?: GenerateOptions): Promise<string> {
  const client = getAnthropicClient()
  const model = getActiveModel()

  const response = await client.messages.create({
    model,
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.3,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  })

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in AI response')
  }
  return textBlock.text
}

export function getProjectDir(): string | null {
  const config = getActiveConfig()
  return config?.project_dir ?? null
}

export function maskApiKey(key: string | null): string {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '...' + key.slice(-4)
}
