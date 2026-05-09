'use client'

import { cn } from '@/lib/utils'

interface FacetCheckboxProps {
  label: string
  count: number
  checked: boolean
  onChange: (checked: boolean) => void
}

export function FacetCheckbox({ label, count, checked, onChange }: FacetCheckboxProps) {
  return (
    <label
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer',
        'hover:bg-slate-100 dark:hover:bg-slate-800',
        checked && 'bg-blue-50 dark:bg-blue-950'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700"
      />
      <span className="flex-1 truncate text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
        {count}
      </span>
    </label>
  )
}
