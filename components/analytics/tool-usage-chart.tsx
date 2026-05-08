'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { ToolUsageStat } from '@/lib/types'

interface Props {
  data: ToolUsageStat[]
}

const COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16']

export function ToolUsageChart({ data }: Props) {
  const chartData = data.map((item) => ({
    name: item.toolName,
    value: item.count,
    percentage: item.percentage,
  }))

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          />
          <Legend
            formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
