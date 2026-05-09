'use client'

import { X } from 'lucide-react'

interface DateRangePickerProps {
  start: string
  end: string
  earliest?: string
  latest?: string
  onChange: (range: { start: string; end: string }) => void
}

export function DateRangePicker({ start, end, onChange }: DateRangePickerProps) {
  const hasSelection = start || end

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={start}
          onChange={(e) => onChange({ start: e.target.value, end })}
          className="flex-1 h-8 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-300"
        />
        <span className="text-xs text-slate-400">to</span>
        <input
          type="date"
          value={end}
          onChange={(e) => onChange({ start, end: e.target.value })}
          className="flex-1 h-8 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-xs text-slate-700 dark:text-slate-300"
        />
        {hasSelection && (
          <button
            onClick={() => onChange({ start: '', end: '' })}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
