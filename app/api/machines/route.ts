import { NextResponse } from 'next/server'
import { getDataSource } from '@/lib/data-source'
import { getUserId } from '@/lib/get-user-id'
import type { MachinesResponse } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await getUserId()
    const ds = getDataSource()
    const machines = await ds.getMachines(userId)

    return NextResponse.json({ machines } satisfies MachinesResponse)
  } catch (error) {
    console.error('Error loading machines:', error)
    return NextResponse.json(
      { error: 'Failed to load machines' },
      { status: 500 }
    )
  }
}
