'use client'

import type { HourOfDayStat } from '@/lib/types'

interface Props {
  data: HourOfDayStat[]
}

export function HourlyHeatmap({ data }: Props) {
  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="grid grid-cols-12 gap-1">
      {data.map((item) => {
        const intensity = item.count / maxCount
        return (
          <div
            key={item.hour}
            className="aspect-square rounded-sm flex items-center justify-center text-[8px] relative group"
            style={{
              backgroundColor: `hsl(217, 91%, ${82 - intensity * 55}%)`,
            }}
            title={`${item.hour}:00 - ${item.hour + 1}:00: ${item.count} 条消息`}
          >
            <span className="text-[10px] text-foreground/50">{item.hour}</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-popover border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
              {item.hour}:00 - {item.hour + 1}:00: {item.count} 条消息
            </div>
          </div>
        )
      })}
    </div>
  )
}
