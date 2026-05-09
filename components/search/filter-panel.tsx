'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FacetCheckbox } from './facet-checkbox'
import { DateRangePicker } from './date-range-picker'
import type { SearchFacets, SearchFilters } from '@/lib/types'
import { cn } from '@/lib/utils'

interface FilterPanelProps {
  facets: SearchFacets | undefined
  activeFilters: SearchFilters
  onFilterChange: (filters: Partial<SearchFilters>) => void
}

export function FilterPanel({ facets, activeFilters, onFilterChange }: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div className="flex-shrink-0 pt-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          title="Show filters"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const sectionClass = "mb-4"
  const sectionTitleClass = "text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2"

  return (
    <div className="w-56 flex-shrink-0 pr-4 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
      <div className="flex items-center justify-between mb-4 pt-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          title="Hide filters"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Date Range */}
      {facets?.dateRange && (
        <div className={sectionClass}>
          <div className={sectionTitleClass}>Date Range</div>
          <DateRangePicker
            start={activeFilters.dateRange?.start || ''}
            end={activeFilters.dateRange?.end || ''}
            earliest={facets.dateRange.earliest}
            latest={facets.dateRange.latest}
            onChange={(range) => onFilterChange({ dateRange: range })}
          />
        </div>
      )}

      {/* Message Type */}
      {facets?.messageTypes && facets.messageTypes.length > 0 && (
        <div className={sectionClass}>
          <div className={sectionTitleClass}>Message Type</div>
          <div className={cn(facets.messageTypes.length > 4 && 'max-h-36 overflow-y-auto')}>
            {facets.messageTypes.map((f) => (
              <FacetCheckbox
                key={f.type}
                label={f.type}
                count={f.count}
                checked={activeFilters.messageType === f.type}
                onChange={(checked) =>
                  onFilterChange({ messageType: checked ? f.type : undefined })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Tool Names */}
      {facets?.toolNames && facets.toolNames.length > 0 && (
        <div className={sectionClass}>
          <div className={sectionTitleClass}>Tools</div>
          <div className={cn(facets.toolNames.length > 4 && 'max-h-36 overflow-y-auto')}>
            {facets.toolNames.slice(0, 15).map((f) => (
              <FacetCheckbox
                key={f.name}
                label={f.name}
                count={f.count}
                checked={activeFilters.toolName === f.name}
                onChange={(checked) =>
                  onFilterChange({ toolName: checked ? f.name : undefined })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {facets?.projects && facets.projects.length > 0 && (
        <div className={sectionClass}>
          <div className={sectionTitleClass}>Projects</div>
          <div className={cn(facets.projects.length > 5 && 'max-h-40 overflow-y-auto')}>
            {facets.projects.map((f) => (
              <FacetCheckbox
                key={f.name}
                label={f.name.split('/').pop() || f.name}
                count={f.count}
                checked={activeFilters.project === f.name}
                onChange={(checked) =>
                  onFilterChange({ project: checked ? f.name : undefined })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Sources */}
      {facets?.sources && facets.sources.length > 0 && (
        <div className={sectionClass}>
          <div className={sectionTitleClass}>Sources</div>
          {facets.sources.map((f) => (
            <FacetCheckbox
              key={f.sourceType}
              label={f.sourceType}
              count={f.count}
              checked={activeFilters.sourceType === f.sourceType}
              onChange={(checked) =>
                onFilterChange({ sourceType: checked ? f.sourceType : undefined })
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
