'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Search, X, ArrowLeft, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { FilterPanel } from '@/components/search/filter-panel'
import { Autocomplete } from '@/components/search/autocomplete'
import { HighlightedSnippet } from '@/components/search/highlighted-snippet'
import type { SearchResult, SearchFilters, SearchFacets, SearchSuggestion } from '@/lib/types'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [facets, setFacets] = useState<SearchFacets | undefined>()
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<HTMLDivElement>(null)

  const [selectedMachine, setSelectedMachine] = useState<string>('all')
  const [machines, setMachines] = useState<{ machineId: string; machineName: string; sessionCount: number }[]>([])

  // Active filters
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({ query: '' })

  // Autocomplete
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DATA_SOURCE_MODE === 'cloud') {
      fetch('/api/machines')
        .then((r) => r.json())
        .then((data) => setMachines(data.machines ?? []))
        .catch(console.error)
    }
  }, [])

  const performSearch = useCallback(async (filters: SearchFilters) => {
    if (!filters.query.trim()) {
      setResults([])
      setFacets(undefined)
      setHasSearched(false)
      return
    }

    setLoading(true)
    setHasSearched(true)

    try {
      const params = new URLSearchParams({ q: filters.query })
      if (filters.project) params.set('project', filters.project)
      if (filters.machineId && filters.machineId !== 'all') params.set('machine', filters.machineId)
      if (filters.sourceType) params.set('source', filters.sourceType)
      if (filters.messageType) params.set('type', filters.messageType)
      if (filters.toolName) params.set('tool', filters.toolName)
      if (filters.dateRange?.start) params.set('from', filters.dateRange.start)
      if (filters.dateRange?.end) params.set('to', filters.dateRange.end)

      const response = await fetch(`/api/search?${params.toString()}`)
      const data = await response.json()
      setResults(data.results ?? [])
      setFacets(data.facets)
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
      setFacets(undefined)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const filters = { ...activeFilters, query }
    setActiveFilters(filters)
    performSearch(filters)
    setShowSuggestions(false)
  }

  function clearSearch() {
    setQuery('')
    setResults([])
    setFacets(undefined)
    setHasSearched(false)
    setActiveFilters({ query: '' })
    inputRef.current?.focus()
  }

  function handleFilterChange(partial: Partial<SearchFilters>) {
    const updated = { ...activeFilters, ...partial }
    setActiveFilters(updated)
    if (updated.query.trim()) {
      performSearch(updated)
    }
  }

  // Autocomplete logic
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    try {
      const params = new URLSearchParams({ q, limit: '10' })
      const response = await fetch(`/api/search/suggestions?${params.toString()}`)
      const data = await response.json()
      setSuggestions(data.suggestions ?? [])
      setShowSuggestions((data.suggestions?.length ?? 0) > 0)
    } catch {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)
    suggestTimeoutRef.current = setTimeout(() => fetchSuggestions(value), 200)
  }

  function handleSuggestionSelect(suggestion: SearchSuggestion) {
    const newQuery = suggestion.label
    setQuery(newQuery)
    setShowSuggestions(false)
    const filters = { ...activeFilters, query: newQuery }
    setActiveFilters(filters)
    performSearch(filters)
  }

  // Re-search when machine filter changes
  useEffect(() => {
    if (!hasSearched || !activeFilters.query.trim()) return
    const filters = {
      ...activeFilters,
      machineId: selectedMachine === 'all' ? undefined : selectedMachine,
    }
    setActiveFilters(filters)
    performSearch(filters)
  }, [selectedMachine]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close autocomplete on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const memoizedSearch = useMemo(() => performSearch, [performSearch])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              Search Conversations
            </h1>
          </div>

          <div className="relative" ref={autocompleteRef}>
            <form onSubmit={handleSubmit} className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                ref={inputRef}
                type="search"
                placeholder="Search through all your conversations..."
                className="pl-10 pr-10"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </form>
            <Autocomplete
              suggestions={suggestions}
              visible={showSuggestions}
              onSelect={handleSuggestionSelect}
            />
          </div>

          {machines.length > 0 && (
            <div className="flex gap-3 mt-3">
              <select
                className="h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
              >
                <option value="all">All Machines</option>
                {machines.map((m) => (
                  <option key={m.machineId} value={m.machineId}>
                    {m.machineName} ({m.sessionCount})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex gap-6">
          {/* Filter sidebar */}
          {hasSearched && (
            <FilterPanel
              facets={facets}
              activeFilters={activeFilters}
              onFilterChange={handleFilterChange}
            />
          )}

          {/* Results area */}
          <main className="flex-1 min-w-0">
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
                <p className="mt-4 text-slate-600 dark:text-slate-400">Searching...</p>
              </div>
            )}

            {!loading && hasSearched && results.length === 0 && (
              <div className="text-center py-12">
                <MessageSquare className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-2">
                  No results found
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Try different keywords or check your filters
                </p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                Found {results.length} result{results.length !== 1 ? 's' : ''}{' '}
                for &quot;{activeFilters.query}&quot;
              </div>
            )}

            <div className="space-y-4">
              {results.map((result) => (
                <Link key={result.session.sessionId} href={`/sessions/${result.session.sessionId}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-base text-slate-900 dark:text-slate-50 line-clamp-1">
                          {result.session.display || 'Untitled Conversation'}
                        </h3>
                      </div>

                      {/* Metadata tags */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {result.session.projectName}
                        </span>
                        {result.session.sourceType && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                            {result.session.sourceType}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          {formatDistanceToNow(result.session.date, { addSuffix: true })}
                        </span>
                        {result.session.messageCount && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {result.session.messageCount} msgs
                          </span>
                        )}
                      </div>

                      {result.matchedMessages.length > 0 && (
                        <div className="space-y-2">
                          {result.matchedMessages.slice(0, 2).map((match, i) => (
                            <div
                              key={i}
                              className="text-sm bg-slate-100 dark:bg-slate-800 rounded p-3"
                            >
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                {match.message.type === 'user' ? 'You' : match.message.type === 'assistant' ? 'Claude' : match.message.type}
                              </p>
                              <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
                                <HighlightedSnippet
                                  headline={match.headline}
                                  snippet={match.snippet}
                                />
                              </p>
                            </div>
                          ))}
                          {result.matchedMessages.length > 2 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              +{result.matchedMessages.length - 2} more match{result.matchedMessages.length - 2 > 1 ? 'es' : ''}
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
