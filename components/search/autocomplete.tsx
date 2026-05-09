'use client'

import { cn } from '@/lib/utils'
import type { SearchSuggestion } from '@/lib/types'
import { FileText, Wrench } from 'lucide-react'

interface AutocompleteProps {
  suggestions: SearchSuggestion[]
  visible: boolean
  onSelect: (suggestion: SearchSuggestion) => void
}

export function Autocomplete({ suggestions, visible, onSelect }: AutocompleteProps) {
  if (!visible || suggestions.length === 0) return null

  return (
    <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg overflow-hidden">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
            'hover:bg-slate-50 dark:hover:bg-slate-800',
            'text-slate-700 dark:text-slate-300'
          )}
        >
          {s.type === 'tool' ? (
            <Wrench className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          ) : (
            <FileText className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
          )}
          <span className="flex-1 truncate">{s.label}</span>
          {s.description && (
            <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[120px]">
              {s.description}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
