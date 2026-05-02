'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowLeft,
  User,
  Bot,
  Download,
  FileText,
  Clock,
  ArrowUp,
  ArrowDown,
  Eye,
  Code,
  Zap,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { JsonViewer } from '@/components/json-viewer'
import { ToolUseViewer, ThinkingViewer, ToolResultViewer } from '@/components/tool-viewer'
import { ContentArrayRenderer } from '@/components/content-array-renderer'
import { UserMessageRenderer } from '@/components/user-message-renderer'
import type { Session, Message } from '@/lib/types'

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
  const pathname = usePathname()
  const router = useRouter()
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [workingDir, setWorkingDir] = useState<string | null>(null)

  // Load session on mount
  useEffect(() => {
    loadSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  // Extract user messages for timeline
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

  // Calculate tool usage statistics
  useEffect(() => {
    const stats = new Map<string, number>()

    messages.forEach((msg) => {
      // Skip FileHistorySnapshot as it doesn't have content
      if (msg.type === 'file-history-snapshot') return

      // Inline version of getContentTypeInfo for tool_use detection
      const messageWithContent = msg as { content: string | unknown }
      let parsedContent: unknown = messageWithContent.content
      if (typeof messageWithContent.content === 'string') {
        try {
          if (messageWithContent.content.trim().startsWith('{') || messageWithContent.content.trim().startsWith('[')) {
            parsedContent = JSON.parse(messageWithContent.content)
          }
        } catch {
          // Not valid JSON, skip
        }
      }

      // Handle array content
      if (Array.isArray(parsedContent) && parsedContent.length > 0) {
        const firstItem = parsedContent[0]
        if (typeof firstItem === 'object' && firstItem !== null && 'type' in firstItem) {
          const itemType = (firstItem as any).type
          const itemName = (firstItem as any).name || null
          if (itemType === 'tool_use' && itemName) {
            const currentCount = stats.get(itemName) || 0
            stats.set(itemName, currentCount + 1)
          }
        }
      }

      // Handle object content
      if (typeof parsedContent === 'object' && parsedContent !== null && 'type' in parsedContent) {
        const itemType = (parsedContent as any).type
        const itemName = (parsedContent as any).name || null
        if (itemType === 'tool_use' && itemName) {
          const currentCount = stats.get(itemName) || 0
          stats.set(itemName, currentCount + 1)
        }
      }
    })

    setToolStats(stats)
  }, [messages])

  // Extract working directory from first user message
  useEffect(() => {
    const firstUserMessage = messages.find(msg => msg.type === 'user')
    if (firstUserMessage && 'cwd' in firstUserMessage && firstUserMessage.cwd) {
      setWorkingDir(firstUserMessage.cwd)
    } else {
      setWorkingDir(null)
    }
  }, [messages])

  // Handle scroll position detection
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const threshold = clientHeight // One page from top/bottom

      if (scrollTop < threshold && scrollTop + clientHeight < scrollHeight - threshold) {
        // Near top but not at bottom
        setShowScrollButton('bottom')
      } else if (scrollTop + clientHeight >= scrollHeight - threshold && scrollTop >= threshold) {
        // Near bottom but not at top
        setShowScrollButton('top')
      } else if (scrollTop >= threshold && scrollTop + clientHeight < scrollHeight - threshold) {
        // In the middle - show both buttons
        setShowScrollButton('both')
      } else {
        // At top or bottom
        setShowScrollButton(null)
      }
    }

    container.addEventListener('scroll', handleScroll)
    // Initial check
    handleScroll()

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [messages])

  // Calculate dot positions based on message positions in the document
  useEffect(() => {
    if (messages.length === 0 || userMessages.length === 0) return

    const calculatePositions = () => {
      const container = scrollContainerRef.current
      if (!container) return

      const containerRect = container.getBoundingClientRect()
      const scrollTop = container.scrollTop
      const scrollHeight = container.scrollHeight - containerRect.height

      const positions = userMessages.map((userMsg) => {
        const element = messageRefs.current.get(userMsg.uuid)
        if (!element) return { uuid: userMsg.uuid, top: 0 }

        const elementRect = element.getBoundingClientRect()
        const relativeTop = elementRect.top - containerRect.top + scrollTop
        const topPercentage = (relativeTop / scrollHeight) * 100

        return { uuid: userMsg.uuid, top: Math.max(0, Math.min(100, topPercentage)) }
      })

      setDotPositions(positions)
    }

    // Calculate after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(calculatePositions, 100)
    // Also calculate on window resize
    window.addEventListener('resize', calculatePositions)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', calculatePositions)
    }
  }, [messages, userMessages, messageRefs])

  // Track currently visible message
  useEffect(() => {
    if (messages.length === 0) return

    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect()
      const scrollTop = container.scrollTop
      const scrollMiddle = scrollTop + containerRect.height / 2

      // Find the message closest to the middle of the viewport
      let closestMessage: { uuid: string; distance: number } | null = null

      messageRefs.current.forEach((element, uuid) => {
        const elementRect = element.getBoundingClientRect()
        const elementMiddle = elementRect.top + scrollTop + elementRect.height / 2
        const distance = Math.abs(elementMiddle - scrollMiddle)

        if (!closestMessage || distance < closestMessage.distance) {
          // Only consider user messages
          const foundMessage = messages.find(m => 'uuid' in m && m.uuid === uuid)
          if (foundMessage?.type === 'user') {
            closestMessage = { uuid, distance }
          }
        }
      })

      if (closestMessage) {
        setActiveMessageUuid((closestMessage as { uuid: string }).uuid)
      }
    }

    container.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [messages])

  function scrollToTop() {
    scrollContainerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  function scrollToBottom() {
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current?.scrollHeight || 0,
      behavior: 'smooth'
    })
  }

  function scrollToMessage(uuid: string) {
    const element = messageRefs.current.get(uuid)
    if (element && scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const containerRect = container.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      const scrollTop = container.scrollTop + (elementRect.top - containerRect.top) - 100

      container.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      })
    }
  }

  async function loadSession() {
    try {
      const response = await fetch(`/api/sessions/${params.id}`)
      if (!response.ok) {
        throw new Error('Session not found')
      }
      const data = await response.json()
      setSession(data.session)
      setMessages(data.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setLoading(false)
    }
  }

  function handleExport(format: 'md' | 'json' | 'html') {
    const sessionId = session?.sessionId || ''
    window.open(`/api/sessions/${sessionId}/export?format=${format}`, '_blank')
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedItem(label)
      setTimeout(() => setCopiedItem(null), 2000)
    }).catch((err) => {
      console.error('Failed to copy:', err)
    })
  }

  interface ContentTypeInfo {
    type: string | null
    name: string | null
  }

  function getContentTypeInfo(content: string | unknown): ContentTypeInfo {
    let parsedContent: unknown = content

    // Parse string content
    if (typeof content === 'string') {
      try {
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
          parsedContent = JSON.parse(content)
        } else {
          return { type: null, name: null }
        }
      } catch {
        return { type: null, name: null }
      }
    }

    // Handle array content - get first item's type
    if (Array.isArray(parsedContent) && parsedContent.length > 0) {
      const firstItem = parsedContent[0]
      if (typeof firstItem === 'object' && firstItem !== null && 'type' in firstItem) {
        const itemType = (firstItem as any).type
        const itemName = (firstItem as any).name || null
        return { type: itemType, name: itemName }
      }
    }

    // Handle object content
    if (typeof parsedContent === 'object' && parsedContent !== null && 'type' in parsedContent) {
      const itemType = (parsedContent as any).type
      const itemName = (parsedContent as any).name || null
      return { type: itemType, name: itemName }
    }

    return { type: null, name: null }
  }

  function renderContent(content: string | unknown): React.ReactNode {
    if (typeof content === 'string') {
      // Try to detect if this is JSON
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(content)
          // Check if this is a tool_use
          if (parsed.type === 'tool_use' || parsed.type === 'server_tool_use') {
            return <ToolUseViewer content={content} data={parsed} />
          }
          return <JsonViewer content={content} data={parsed} />
        } catch {
          // Not valid JSON, render as markdown
          return <MarkdownRenderer content={content} />
        }
      }
      return <MarkdownRenderer content={content} />
    }

    // Handle array content (multiple content blocks)
    if (Array.isArray(content)) {
      return <ContentArrayRenderer content={content} />
    }

    // Handle object content (e.g., thinking blocks)
    if (typeof content === 'object' && content !== null) {
      if ('type' in content && content.type === 'thinking') {
        return <ThinkingViewer content={content} />
      }
      // Try to stringify object as JSON
      try {
        const jsonStr = JSON.stringify(content, null, 2)
        return <JsonViewer content={jsonStr} data={content} />
      } catch {
        return <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded">{String(content)}</pre>
      }
    }
    return String(content ?? '')
  }

  function formatDateTime(timestamp: number): string {
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  function renderMessage(msg: Message) {
    const isRaw = showRawMessage === msg.uuid

    if (msg.type === 'user') {
      return (
        <div
          key={msg.uuid}
          ref={(el) => {
            if (el) messageRefs.current.set(msg.uuid, el)
          }}
          className="flex gap-3 mb-6 scroll-mt-20"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <User className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">You</span>
              {msg.timestamp && (
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDateTime(typeof msg.timestamp === 'string' ? new Date(msg.timestamp).getTime() : msg.timestamp || 0)}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowRawMessage(isRaw ? null : msg.uuid)
                }}
                className="h-6 px-2 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500"
                title={isRaw ? "Show rendered" : "Show raw"}
              >
                {isRaw ? (
                  <>
                    <Eye className="w-3 h-3 mr-1" />
                    Rendered
                  </>
                ) : (
                  <>
                    <Code className="w-3 h-3 mr-1" />
                    Raw
                  </>
                )}
              </Button>
            </div>
            <div className="max-w-none rounded-lg bg-green-50/50 dark:bg-green-900/10 p-3">
              <UserMessageRenderer content={msg.content} isRaw={isRaw} />
            </div>
          </div>
        </div>
      )
    }

    if (msg.type === 'assistant') {
      const contentInfo = getContentTypeInfo(msg.content)

      return (
        <div key={msg.uuid} className="flex gap-3 mb-6">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {contentInfo.type === 'tool_use' && contentInfo.name ? (
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  {contentInfo.name}
                </span>
              ) : contentInfo.type ? (
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{contentInfo.type}</span>
              ) : null}
              {msg.timestamp && (
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDateTime(typeof msg.timestamp === 'string' ? new Date(msg.timestamp).getTime() : msg.timestamp || 0)}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowRawMessage(isRaw ? null : msg.uuid)
                }}
                className="h-6 px-2 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500"
                title={isRaw ? "Show rendered" : "Show raw"}
              >
                {isRaw ? (
                  <>
                    <Eye className="w-3 h-3 mr-1" />
                    Rendered
                  </>
                ) : (
                  <>
                    <Code className="w-3 h-3 mr-1" />
                    Raw
                  </>
                )}
              </Button>
            </div>
            <div className="max-w-none">
              {isRaw ? (
                <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded text-xs whitespace-pre max-w-full overflow-x-auto">
                  {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
                </pre>
              ) : (
                renderContent(msg.content)
              )}
            </div>
          </div>
        </div>
      )
    }

    if (msg.type === 'tool_use') {
      const contentInfo = getContentTypeInfo(msg.content)

      return (
        <div
          key={msg.uuid}
          ref={(el) => {
            if (el) messageRefs.current.set(msg.uuid, el)
          }}
          className="flex gap-3 mb-6 scroll-mt-20"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {contentInfo.type === 'tool_use' && contentInfo.name ? (
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  {contentInfo.name}
                </span>
              ) : contentInfo.type ? (
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{contentInfo.type}</span>
              ) : null}
              {msg.timestamp && (
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDateTime(typeof msg.timestamp === 'string' ? new Date(msg.timestamp).getTime() : msg.timestamp || 0)}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowRawMessage(isRaw ? null : msg.uuid)
                }}
                className="h-6 px-2 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500"
                title={isRaw ? "Show rendered" : "Show raw"}
              >
                {isRaw ? (
                  <>
                    <Eye className="w-3 h-3 mr-1" />
                    Rendered
                  </>
                ) : (
                  <>
                    <Code className="w-3 h-3 mr-1" />
                    Raw
                  </>
                )}
              </Button>
            </div>
            <div className="max-w-none">
              {isRaw ? (
                <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded text-xs whitespace-pre max-w-full overflow-x-auto">
                  {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
                </pre>
              ) : (
                renderContent(msg.content)
              )}
            </div>
          </div>
        </div>
      )
    }

    if (msg.type === 'tool_result') {
      const contentInfo = getContentTypeInfo(msg.content)

      return (
        <div
          key={msg.uuid}
          ref={(el) => {
            if (el) messageRefs.current.set(msg.uuid, el)
          }}
          className="flex gap-3 mb-6 scroll-mt-20"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {contentInfo.type ? (
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{contentInfo.type}</span>
              ) : (
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{msg.type}</span>
              )}
              {msg.timestamp && (
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDateTime(typeof msg.timestamp === 'string' ? new Date(msg.timestamp).getTime() : msg.timestamp || 0)}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowRawMessage(isRaw ? null : msg.uuid)
                }}
                className="h-6 px-2 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500"
                title={isRaw ? "Show rendered" : "Show raw"}
              >
                {isRaw ? (
                  <>
                    <Eye className="w-3 h-3 mr-1" />
                    Rendered
                  </>
                ) : (
                  <>
                    <Code className="w-3 h-3 mr-1" />
                    Raw
                  </>
                )}
              </Button>
            </div>
            <div className="max-w-none rounded-lg bg-teal-50/50 dark:bg-teal-900/10 p-3">
              {isRaw ? (
                <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded text-xs whitespace-pre max-w-full overflow-x-auto">
                  {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
                </pre>
              ) : (
                renderContent(msg.content)
              )}
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading conversation...</p>
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">{error || 'This session does not exist'}</p>
            <Link href="/sessions">
              <Button>Back to Sessions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Link href="/sessions">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50 line-clamp-1">
                  {session.display}
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {session.projectName} · {formatDistanceToNow(new Date(session.date), { addSuffix: true })}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-slate-500 dark:text-slate-500">ID:</span>
                  <code className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded font-mono">
                    {session.sessionId}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(session.sessionId, 'sessionId')}
                    className="h-6 px-2 text-slate-400 hover:text-slate-600 dark:text-slate-500"
                    title={copiedItem === 'sessionId' ? 'Copied!' : 'Copy session ID'}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    {copiedItem === 'sessionId' ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const cmd = workingDir
                        ? `cd "${workingDir}" && claude --resume ${session.sessionId}`
                        : `claude --resume ${session.sessionId}`
                      copyToClipboard(cmd, 'continueCmd')
                    }}
                    className="h-6 px-2 text-xs"
                    title={copiedItem === 'continueCmd' ? 'Copied!' : 'Copy continue session command'}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    {copiedItem === 'continueCmd' ? 'Copied!' : 'Copy continue cmd'}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('md')}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Tool Usage Statistics */}
      {toolStats.size > 0 && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Tools used:</span>
              {Array.from(toolStats.entries())
                .sort(([, a], [, b]) => b - a)
                .map(([toolName, count]) => (
                  <span
                    key={toolName}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-md text-xs font-medium"
                  >
                    <Zap className="w-3 h-3" />
                    {toolName}
                    <span className="text-amber-500 dark:text-amber-500">×{count}</span>
                  </span>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <div className="relative max-w-4xl w-full">
          {/* Main Content */}
          <main
            ref={scrollContainerRef}
            className="px-4 py-8 overflow-y-auto w-full"
            style={{ maxHeight: 'calc(100vh - 73px)' }}
          >
          <Card>
            <CardContent className="p-6">
              {messages.length === 0 ? (
                <p className="text-center text-slate-600 dark:text-slate-400 py-8">
                  No messages in this conversation
                </p>
              ) : (
                messages.map(renderMessage)
              )}
            </CardContent>
          </Card>
        </main>

          {/* Right-side Navigation Dots - positioned relative to main */}
          {dotPositions.length > 0 && (
            <aside
              className="absolute top-0 pointer-events-none"
              style={{
                right: '-20px',
                height: 'calc(100vh - 73px)'
              }}
            >
              <div className="pointer-events-auto py-2 h-full relative">
                {/* Connecting line */}
                <div className="absolute left-1/2 top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700 -translate-x-1/2" />
                <div className="flex flex-col gap-1 px-1 justify-between h-full relative">
                {dotPositions.map((dot) => {
                  const isActive = dot.uuid === activeMessageUuid

                  return (
                    <button
                      key={dot.uuid}
                      onClick={() => scrollToMessage(dot.uuid)}
                      className="flex-shrink-0"
                      style={{ top: `${dot.top}%` }}
                    >
                      <div
                        className={`w-2 h-2 rounded-full transition-all ${
                          isActive
                            ? 'bg-blue-600 dark:bg-blue-400 scale-125'
                            : 'bg-slate-400 dark:bg-slate-500 hover:bg-slate-500 dark:hover:bg-slate-400'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>
        )}
        </div>
      </div>

      {/* Floating scroll buttons */}
      {showScrollButton && (
        <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-2">
          {showScrollButton === 'top' || showScrollButton === 'both' ? (
            <Button
              size="icon"
              onClick={scrollToTop}
              className="h-12 w-12 rounded-full shadow-lg"
              title="Scroll to top"
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
          ) : null}
          {showScrollButton === 'bottom' || showScrollButton === 'both' ? (
            <Button
              size="icon"
              onClick={scrollToBottom}
              className="h-12 w-12 rounded-full shadow-lg"
              title="Scroll to bottom"
            >
              <ArrowDown className="h-5 w-5" />
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
