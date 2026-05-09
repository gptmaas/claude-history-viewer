'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Cpu, Eye, Lock, ArrowLeft } from 'lucide-react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ToolUseViewer, ThinkingViewer, ToolResultViewer } from '@/components/tool-viewer'
import { ContentArrayRenderer } from '@/components/content-array-renderer'
import { UserMessageRenderer } from '@/components/user-message-renderer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Message } from '@/lib/types'

interface SharedData {
  session: {
    display: string
    project: string
    projectName: string
    timestamp: number
    date: string
    messageCount?: number
  }
  messages: Message[]
  sharedAt: string
  ownerName: string
}

export default function SharePage() {
  const params = useParams()
  const slug = params.slug as string

  const [data, setData] = useState<SharedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [password, setPassword] = useState('')

  const loadShared = async (pwd?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = pwd ? `/api/share/${slug}?password=${encodeURIComponent(pwd)}` : `/api/share/${slug}`
      const res = await fetch(url)
      const json = await res.json()

      if (res.status === 403 && json.requiresPassword) {
        setRequiresPassword(true)
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError(json.error || 'Failed to load')
        setLoading(false)
        return
      }

      setData(json)
      setRequiresPassword(false)
    } catch {
      setError('Network error')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (slug) loadShared()
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmitPassword = (e: React.FormEvent) => {
    e.preventDefault()
    loadShared(password)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
          <Cpu className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
        <a href="/" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />Back to CodeMemory
        </a>
      </div>
    )
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <p className="text-sm text-muted-foreground">This link is password protected</p>
        <form onSubmit={handleSubmitPassword} className="flex items-center gap-2">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-64"
          />
          <Button type="submit">Unlock</Button>
        </form>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Cpu className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-foreground">CodeMemory</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">Shared Session</span>
          </div>
          <h1 className="text-base font-medium text-foreground mt-2 line-clamp-1">{data.session.display}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-muted-foreground">
              Shared by {data.ownerName} · {new Date(data.sharedAt).toLocaleDateString()}
            </span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Eye className="w-3 h-3" />{data.messages.length} messages
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="space-y-4">
          {data.messages.map((msg, idx) => (
            <div key={msg.uuid || idx} className="group">
              {msg.type === 'user' && (
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-blue-500">U</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <UserMessageRenderer content={msg.content} isRaw={false} />
                  </div>
                </div>
              )}
              {msg.type === 'assistant' && (
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-emerald-500">A</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {typeof msg.content === 'string' ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : (
                      <ContentArrayRenderer content={msg.content as unknown[]} />
                    )}
                  </div>
                </div>
              )}
              {msg.type === 'tool_use' && (
                <ToolUseViewer content={typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)} data={msg.content} />
              )}
              {msg.type === 'tool_result' && (
                <ToolResultViewer content={msg.content} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border mt-8">
        <div className="max-w-4xl mx-auto px-6 py-4 text-center">
          <a href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Powered by CodeMemory — AI Coding Analytics
          </a>
        </div>
      </div>
    </div>
  )
}
