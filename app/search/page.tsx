'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Search, X, ArrowLeft, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import type { SearchResult, Machine } from '@/lib/types'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [machines, setMachines] = useState<Machine[]>([])
  const [selectedMachine, setSelectedMachine] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState('')

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

  async function performSearch(searchQuery: string) {
    if (!searchQuery.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    setLoading(true)
    setHasSearched(true)

    try {
      const params = new URLSearchParams({ q: searchQuery })
      if (selectedMachine !== 'all') params.set('machine', selectedMachine)
      if (projectFilter.trim()) params.set('project', projectFilter.trim())

      const response = await fetch(`/api/search?${params.toString()}`)
      const data = await response.json()
      setResults(data.results)
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    performSearch(query)
  }

  function clearSearch() {
    setQuery('')
    setResults([])
    setHasSearched(false)
    inputRef.current?.focus()
  }

  useEffect(() => {
    if (hasSearched && query.trim()) {
      performSearch(query)
    }
  }, [selectedMachine, projectFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  function highlightSnippet(snippet: string, query: string) {
    if (!query) return snippet

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = snippet.split(regex)

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

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

          <form onSubmit={handleSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              ref={inputRef}
              type="search"
              placeholder="Search through all your conversations..."
              className="pl-10 pr-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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

          <div className="flex gap-3 mt-3">
            <Input
              type="search"
              placeholder="Filter by project name..."
              className="h-9 text-xs max-w-sm"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            />
            {machines.length > 0 && (
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
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
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
              Try different keywords or check your spelling
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Found {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
          </div>
        )}

        <div className="space-y-4">
          {results.map((result) => (
            <Link key={result.session.sessionId} href={`/sessions/${result.session.sessionId}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-50 mb-2 line-clamp-1">
                    {result.session.display || 'Untitled Conversation'}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    {result.session.projectName} · {formatDistanceToNow(result.session.date, { addSuffix: true })}
                  </p>

                  {result.matchedMessages.length > 0 && (
                    <div className="space-y-2">
                      {result.matchedMessages.slice(0, 2).map((match, i) => (
                        <div
                          key={i}
                          className="text-sm bg-slate-100 dark:bg-slate-800 rounded p-3"
                        >
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            {match.message.type === 'user' ? 'You' : 'Claude'}
                          </p>
                          <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
                            {highlightSnippet(match.snippet, query)}
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
  )
}
