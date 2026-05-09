'use client'

import { useState, useEffect, useCallback } from 'react'
import { Share2, Copy, Clock, Trash2, Eye, Link2, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ShareDialogProps {
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ShareLink {
  slug: string
  sessionDisplay: string
  expiresAt: string | null
  viewCount: number
  isActive: boolean
  createdAt: string
}

type Tab = 'create' | 'manage'

const expiryOptions = [
  { label: '1 小时', hours: 1 },
  { label: '1 天', hours: 24 },
  { label: '1 周', hours: 168 },
  { label: '永不过期', hours: null },
]

export function ShareDialog({ sessionId, open, onOpenChange }: ShareDialogProps) {
  const [tab, setTab] = useState<Tab>('create')
  const [expiresIn, setExpiresIn] = useState<number | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [links, setLinks] = useState<ShareLink[]>([])
  const [linksLoading, setLinksLoading] = useState(false)

  const loadLinks = useCallback(async () => {
    setLinksLoading(true)
    try {
      const res = await fetch('/api/share/manage')
      if (res.ok) {
        const data = await res.json()
        setLinks(data.links || [])
      }
    } catch {
      // ignore
    }
    setLinksLoading(false)
  }, [])

  useEffect(() => {
    if (open && tab === 'manage') {
      loadLinks()
    }
  }, [open, tab, loadLinks])

  const handleCreate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          expiresIn,
          password: password || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create share link')
        return
      }
      setGeneratedUrl(data.url)
    } catch {
      setError('Network error')
    }
    setLoading(false)
  }

  const handleRevoke = async (slug: string) => {
    try {
      const res = await fetch('/api/share/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.slug !== slug))
      }
    } catch {
      // ignore
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reset = () => {
    setGeneratedUrl(null)
    setPassword('')
    setError(null)
    setExpiresIn(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            分享会话
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['create', 'manage'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                tab === t
                  ? 'text-foreground border-b-2 border-blue-500'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'create' ? '创建链接' : '管理链接'}
            </button>
          ))}
        </div>

        {tab === 'create' && (
          <div className="space-y-4">
            {generatedUrl ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">链接已创建：</p>
                <div className="flex items-center gap-2">
                  <Input value={generatedUrl} readOnly className="text-xs font-mono" />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => copyToClipboard(generatedUrl)}
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={reset}
                >
                  创建另一个链接
                </Button>
              </div>
            ) : (
              <>
                {/* Expiry */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">过期时间</label>
                  <div className="flex gap-2 flex-wrap">
                    {expiryOptions.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setExpiresIn(opt.hours)}
                        className={cn(
                          'px-3 py-1.5 text-xs rounded-md border transition-colors',
                          expiresIn === opt.hours
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <Clock className="w-3 h-3 inline mr-1" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    密码保护（可选）
                  </label>
                  <Input
                    type="password"
                    placeholder="留空则无需密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}

                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={loading}
                >
                  {loading ? '生成中...' : '生成分享链接'}
                </Button>
              </>
            )}
          </div>
        )}

        {tab === 'manage' && (
          <div className="space-y-2 max-h-60 overflow-auto">
            {linksLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">加载中...</p>
            ) : links.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无分享链接</p>
            ) : (
              links.map((link) => (
                <div
                  key={link.slug}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">
                      {link.sessionDisplay}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Eye className="w-3 h-3" />{link.viewCount}
                      </span>
                      {link.expiresAt && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(link.expiresAt) < new Date() ? '已过期' : new Date(link.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      {!link.isActive && (
                        <span className="text-[11px] text-red-500">已撤销</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        const url = `${window.location.origin}/share/${link.slug}`
                        copyToClipboard(url)
                      }}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </Button>
                    {link.isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600"
                        onClick={() => handleRevoke(link.slug)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
