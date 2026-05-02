import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export async function getUserId(): Promise<string> {
  const mode = process.env.DATA_SOURCE_MODE || 'local'
  if (mode !== 'cloud') return ''

  const session = await getServerSession(authOptions)
  return session?.user?.id || ''
}
