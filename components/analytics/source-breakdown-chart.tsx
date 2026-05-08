'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { SourceBreakdown } from '@/lib/types'

interface Props {
  data: SourceBreakdown[]
}

const COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#22c55e', '#8b5cf6']

export function SourceBreakdownChart({ data }: Props) {
  const chartData = data.map(item => ({
    name: item.sourceType,
    sessions: item.sessionCount,
    messages: item.messageCount,
    percentage: item.percentage,
  }))

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          />
          <Legend formatter={(value) => value === 'sessions' ? '会话数' : '消息数'} />
          <Bar dataKey="sessions" stackId="a" fill="#3b82f6" name="sessions" />
          <Bar dataKey="messages" stackId="a" fill="#14b8a6" name="messages" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
