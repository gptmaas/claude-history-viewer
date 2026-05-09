'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft, User, Bot, Download, FileText, Clock, ArrowUp, ArrowDown, Eye, Code, Zap, Copy, Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { JsonViewer } from '@/components/json-viewer'
import { ToolUseViewer, ThinkingViewer, ToolResultViewer } from '@/components/tool-viewer'
import { ContentArrayRenderer } from '@/components/content-array-renderer'
import { UserMessageRenderer } from '@/components/user-message-renderer'
import type { Session, Message } from '@/lib/types'
import { ShareDialog } from '@/components/share-dialog'

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showScrollButton, setShowScrollButton] = useState<'top' | 'bottom' | 'both' | null>(null)
  const [userMessages, setUserMessages] = useState<Array<{ uuid: string; timestamp: number }>>([])
  const [toolStats, setToolStats] = useState<Map<string, number>>(new Map())
  const [activeMessageUuid, setActiveMessageUuid] = useState<string | null>(null)
  const [dotPositions, setDotPositions] = useState<Array<{ uuid: string; top: number }>>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [showRawMessage, setShowRawMessage] = useState<string | null>(null)
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [workingDir, setWorkingDir] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  useEffect(() => { loadSession() }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const users: Array<{ uuid: string; timestamp: number }> = []
    messages.forEach((msg) => {
      if (msg.type === 'user') {
        const ts = msg.timestamp ? (typeof msg.timestamp === 'string' ? new Date(msg.timestamp).getTime() : new Date(msg.timestamp).getTime()) : Date.now()
        users.push({ uuid: msg.uuid, timestamp: ts })
      }
    })
    setUserMessages(users)
  }, [messages])

  useEffect(() => {
    const stats = new Map<string, number>()
    messages.forEach((msg) => {
      if (msg.type === 'file-history-snapshot') return
      let parsed: unknown = (msg as { content: unknown }).content
      if (typeof parsed === 'string') { try { if (parsed.trim().startsWith('{') || parsed.trim().startsWith('[')) parsed = JSON.parse(parsed) } catch { /* skip */ } }
      const check = (o: unknown) => { if (typeof o === 'object' && o !== null && 'type' in o) { const t = (o as Record<string, unknown>).type; const n = (o as Record<string, unknown>).name; if (t === 'tool_use' && n) stats.set(n as string, (stats.get(n as string) || 0) + 1) } }
      if (Array.isArray(parsed) && parsed.length > 0) check(parsed[0])
      else check(parsed)
    })
    setToolStats(stats)
  }, [messages])

  useEffect(() => {
    const first = messages.find(m => m.type === 'user')
    setWorkingDir(first && 'cwd' in first && first.cwd ? first.cwd as string : null)
  }, [messages])

  useEffect(() => {
    const c = scrollContainerRef.current; if (!c) return
    const h = () => {
      const { scrollTop, scrollHeight, clientHeight } = c; const t = clientHeight
      if (scrollTop < t && scrollTop + clientHeight < scrollHeight - t) setShowScrollButton('bottom')
      else if (scrollTop + clientHeight >= scrollHeight - t && scrollTop >= t) setShowScrollButton('top')
      else if (scrollTop >= t && scrollTop + clientHeight < scrollHeight - t) setShowScrollButton('both')
      else setShowScrollButton(null)
    }
    c.addEventListener('scroll', h); h(); return () => c.removeEventListener('scroll', h)
  }, [messages])

  useEffect(() => {
    if (!messages.length || !userMessages.length) return
    const calc = () => {
      const c = scrollContainerRef.current; if (!c) return
      const cr = c.getBoundingClientRect(); const st = c.scrollTop; const sh = c.scrollHeight - cr.height
      setDotPositions(userMessages.map(um => {
        const el = messageRefs.current.get(um.uuid); if (!el) return { uuid: um.uuid, top: 0 }
        return { uuid: um.uuid, top: Math.max(0, Math.min(100, ((el.getBoundingClientRect().top - cr.top + st) / sh) * 100)) }
      }))
    }
    const tid = setTimeout(calc, 100); window.addEventListener('resize', calc)
    return () => { clearTimeout(tid); window.removeEventListener('resize', calc) }
  }, [messages, userMessages])

  useEffect(() => {
    if (!messages.length) return
    const c = scrollContainerRef.current; if (!c) return
    const h = () => {
      const cr = c.getBoundingClientRect(); const mid = c.scrollTop + cr.height / 2
      let closestUuid: string | null = null
      let closestDist = Infinity
      messageRefs.current.forEach((el, uuid) => {
        const em = el.getBoundingClientRect().top + c.scrollTop + el.getBoundingClientRect().height / 2
        const d = Math.abs(em - mid)
        const msg = messages.find((m: any) => 'uuid' in m && m.uuid === uuid)
        if (msg?.type === 'user' && d < closestDist) { closestUuid = uuid; closestDist = d }
      })
      if (closestUuid) setActiveMessageUuid(closestUuid)
    }
    c.addEventListener('scroll', h); h(); return () => c.removeEventListener('scroll', h)
  }, [messages])

  async function loadSession() {
    try {
      const r = await fetch(`/api/sessions/${params.id}`)
      if (!r.ok) throw new Error('Session not found')
      const d = await r.json(); setSession(d.session); setMessages(d.messages)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load session') }
    finally { setLoading(false) }
  }

  function handleExport(f: 'md' | 'json' | 'html') { window.open(`/api/sessions/${session?.sessionId || ''}/export?format=${f}`, '_blank') }
  function copyToClipboard(t: string, l: string) { navigator.clipboard.writeText(t).then(() => { setCopiedItem(l); setTimeout(() => setCopiedItem(null), 2000) }).catch(console.error) }

  function getCType(c: string | unknown): { type: string | null; name: string | null } {
    let p: unknown = c
    if (typeof c === 'string') { try { if (c.trim().startsWith('{') || c.trim().startsWith('[')) p = JSON.parse(c); else return { type: null, name: null } } catch { return { type: null, name: null } } }
    const chk = (o: unknown) => { if (typeof o === 'object' && o !== null && 'type' in o) return { type: (o as Record<string, unknown>).type as string, name: ((o as Record<string, unknown>).name as string) || null }; return { type: null, name: null } }
    if (Array.isArray(p) && p.length > 0) return chk(p[0])
    if (typeof p === 'object') return chk(p)
    return { type: null, name: null }
  }

  function renderContent(content: string | unknown): React.ReactNode {
    if (typeof content === 'string') {
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        try { const p = JSON.parse(content); if (p.type === 'tool_use' || p.type === 'server_tool_use') return <ToolUseViewer content={content} data={p} />; return <JsonViewer content={content} data={p} /> }
        catch { return <MarkdownRenderer content={content} /> }
      }
      return <MarkdownRenderer content={content} />
    }
    if (Array.isArray(content)) return <ContentArrayRenderer content={content} />
    if (typeof content === 'object' && content !== null) {
      if ('type' in content && content.type === 'thinking') return <ThinkingViewer content={content} />
      try { return <JsonViewer content={JSON.stringify(content, null, 2)} data={content} /> } catch { return <pre className="text-xs bg-muted p-2 rounded">{String(content)}</pre> }
    }
    return String(content ?? '')
  }

  function fmtDT(ts: number | string): string {
    const d = new Date(typeof ts === 'string' ? ts : ts); const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  }

  function renderMessage(msg: Message) {
    const raw = showRawMessage === msg.uuid
    const rawBtn = (
      <button onClick={() => setShowRawMessage(raw ? null : (msg.uuid ?? null))} className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground transition-colors" title={raw ? 'Show rendered' : 'Show raw'}>
        {raw ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
      </button>
    )

    if (msg.type === 'user') return (
      <div key={msg.uuid} ref={el => { if (el) messageRefs.current.set(msg.uuid, el) }} className="flex gap-3 mb-6 scroll-mt-20">
        <div className="shrink-0 w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center"><User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">You</span>
            {msg.timestamp && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{fmtDT(msg.timestamp)}</span>}
            {rawBtn}
          </div>
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-3"><UserMessageRenderer content={msg.content} isRaw={raw} /></div>
        </div>
      </div>
    )

    if (msg.type === 'assistant') { const ci = getCType(msg.content); return (
      <div key={msg.uuid} className="flex gap-3 mb-6">
        <div className="shrink-0 w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {ci.type === 'tool_use' && ci.name && <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />{ci.name}</span>}
            {msg.timestamp && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{fmtDT(msg.timestamp)}</span>}
            {rawBtn}
          </div>
          <div className="min-w-0">{raw ? <pre className="bg-muted border border-border p-4 rounded-lg text-xs whitespace-pre max-w-full overflow-x-auto">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}</pre> : renderContent(msg.content)}</div>
        </div>
      </div>
    )}

    if (msg.type === 'tool_use') { const ci = getCType(msg.content); return (
      <div key={msg.uuid} ref={el => { if (el) messageRefs.current.set(msg.uuid, el) }} className="flex gap-3 mb-6 scroll-mt-20">
        <div className="shrink-0 w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {ci.type === 'tool_use' && ci.name && <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />{ci.name}</span>}
            {msg.timestamp && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{fmtDT(msg.timestamp)}</span>}
            {rawBtn}
          </div>
          <div className="min-w-0">{raw ? <pre className="bg-muted border border-border p-4 rounded-lg text-xs whitespace-pre max-w-full overflow-x-auto">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}</pre> : renderContent(msg.content)}</div>
        </div>
      </div>
    )}

    if (msg.type === 'tool_result') { const ci = getCType(msg.content); return (
      <div key={msg.uuid} ref={el => { if (el) messageRefs.current.set(msg.uuid, el) }} className="flex gap-3 mb-6 scroll-mt-20">
        <div className="shrink-0 w-7 h-7 rounded-full bg-teal-500/10 flex items-center justify-center"><FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">{ci.type || msg.type}</span>
            {msg.timestamp && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{fmtDT(msg.timestamp)}</span>}
            {rawBtn}
          </div>
          <div className="rounded-lg bg-teal-500/5 border border-teal-500/10 p-3">{raw ? <pre className="bg-muted p-4 rounded text-xs whitespace-pre max-w-full overflow-x-auto">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}</pre> : renderContent(msg.content)}</div>
        </div>
      </div>
    )}

    return null
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center"><div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent" /><p className="mt-3 text-sm text-muted-foreground">Loading conversation...</p></div>
    </div>
  )

  if (error || !session) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-sm">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/20 mb-3" />
        <h2 className="text-sm font-medium text-foreground mb-1">Session Not Found</h2>
        <p className="text-xs text-muted-foreground mb-4">{error || 'This session does not exist'}</p>
        <Link href="/sessions"><Button size="sm" className="text-xs">Back to Sessions</Button></Link>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Link href="/sessions"><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Button></Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-medium text-foreground line-clamp-1">{session.display}</h1>
              <p className="text-[11px] text-muted-foreground">{session.projectName} · {formatDistanceToNow(new Date(session.date), { addSuffix: true })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { const cmd = workingDir ? `cd "${workingDir}" && claude --resume ${session.sessionId}` : `claude --resume ${session.sessionId}`; copyToClipboard(cmd, 'continueCmd') }} className="h-7 text-[11px] border-border text-muted-foreground hover:text-foreground">
              <Copy className="w-3 h-3 mr-1" />{copiedItem === 'continueCmd' ? 'Copied!' : 'Continue cmd'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('md')} className="h-7 text-[11px] border-border text-muted-foreground hover:text-foreground">
              <Download className="w-3 h-3 mr-1" />Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} className="h-7 text-[11px] border-border text-muted-foreground hover:text-foreground">
              <Share2 className="w-3 h-3 mr-1" />Share
            </Button>
          </div>
        </div>
      </div>

      {toolStats.size > 0 && (
        <div className="px-6 py-2 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-muted-foreground">Tools:</span>
            {Array.from(toolStats.entries()).sort(([, a], [, b]) => b - a).map(([name, count]) => (
              <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/15 text-amber-700 dark:text-amber-400 rounded text-[10px] font-medium">
                <Zap className="w-2.5 h-2.5" />{name}<span className="text-amber-600/50 dark:text-amber-500/60">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex justify-center overflow-hidden">
        <div className="relative max-w-4xl w-full">
          <main ref={scrollContainerRef} className="px-6 py-6 overflow-y-auto w-full" style={{ maxHeight: 'calc(100vh - 120px)' }}>
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                {messages.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">No messages in this conversation</p> : messages.map(renderMessage)}
              </CardContent>
            </Card>
          </main>

          {dotPositions.length > 0 && (
            <aside className="absolute top-0 pointer-events-none" style={{ right: '-20px', height: 'calc(100vh - 120px)' }}>
              <div className="pointer-events-auto py-2 h-full relative">
                <div className="absolute left-1/2 top-2 bottom-2 w-px bg-border -translate-x-1/2" />
                <div className="flex flex-col gap-1 px-1 justify-between h-full relative">
                  {dotPositions.map(d => {
                    const active = d.uuid === activeMessageUuid
                    return (<button key={d.uuid} onClick={() => { const el = messageRefs.current.get(d.uuid); if (el && scrollContainerRef.current) { const c = scrollContainerRef.current; c.scrollTo({ top: c.scrollTop + (el.getBoundingClientRect().top - c.getBoundingClientRect().top) - 100, behavior: 'smooth' }) } }} className="flex-shrink-0" style={{ top: `${d.top}%` }}><div className={`w-1.5 h-1.5 rounded-full transition-all ${active ? 'bg-primary scale-125' : 'bg-border hover:bg-muted-foreground'}`} /></button>)
                  })}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {showScrollButton && (
        <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-2">
          {(showScrollButton === 'top' || showScrollButton === 'both') && <Button size="icon" onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} className="h-10 w-10 rounded-full shadow-lg bg-card border border-border text-muted-foreground hover:text-foreground"><ArrowUp className="h-4 w-4" /></Button>}
          {(showScrollButton === 'bottom' || showScrollButton === 'both') && <Button size="icon" onClick={() => scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current?.scrollHeight || 0, behavior: 'smooth' })} className="h-10 w-10 rounded-full shadow-lg bg-card border border-border text-muted-foreground hover:text-foreground"><ArrowDown className="h-4 w-4" /></Button>}
        </div>
      )}

      <ShareDialog sessionId={session.sessionId} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  )
}
