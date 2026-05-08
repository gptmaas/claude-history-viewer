'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { SessionDurationStats } from '@/lib/types'

interface Props {
  data: SessionDurationStats
}

const COLORS = ['#3b82f6', '#14b8a6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444']

export function SessionDurationChart({ data }: Props) {
  return (
    <div>
      <div className="flex gap-8 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold">{data.averageMinutes}</div>
          <div className="text-xs text-muted-foreground">平均时长(分钟)</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{data.medianMinutes}</div>
          <div className="text-xs text-muted-foreground">中位时长(分钟)</div>
        </div>
        {data.longestSession && (
          <div className="text-center">
            <div className="text-2xl font-bold">{data.longestSession.minutes}</div>
            <div className="text-xs text-muted-foreground">最长会话(分钟)</div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[100px]" title={data.longestSession.display}>
              {data.longestSession.display.slice(0, 20)}
            </div>
          </div>
        )}
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.distribution} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="range" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            />
            <Bar dataKey="count" name="会话数" radius={[4, 4, 0, 0]}>
              {data.distribution.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
