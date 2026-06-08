'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Copy, Plus, Trash2, Settings2, Key, Database, Info } from 'lucide-react'
import { AiConfigSection } from '@/components/pipeline/ai-config-section'

interface ApiKeyInfo {
  id: string
  keyPrefix: string
  name: string
  lastUsedAt: string | null
  createdAt: string
}

type SettingsTab = 'ai' | 'api-keys' | 'about'

const allTabs: Array<{ id: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'ai', label: 'AI 配置', icon: Settings2 },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'about', label: '关于', icon: Info },
]

function getTabs(isLocal: boolean) {
  if (isLocal) return allTabs.filter(t => t.id !== 'api-keys')
  return allTabs
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<SettingsTab>('ai')
  const [keys, setKeys] = useState<ApiKeyInfo[]>([])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const isLocalMode = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DATA_SOURCE_MODE === 'local'

  useEffect(() => {
    if (isLocalMode) return
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router, isLocalMode])

  useEffect(() => {
    if (!isLocalMode && status !== 'authenticated') return
    fetch('/api/keys')
      .then((r) => r.json())
      .then((data) => {
        setKeys(data.keys ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [status, isLocalMode])

  const createKey = async () => {
    const res = await fetch('/api/keys', { method: 'POST' })
    const data = await res.json()
    if (data.apiKey) {
      setNewKey(data.apiKey)
      const listRes = await fetch('/api/keys')
      const listData = await listRes.json()
      setKeys(listData.keys ?? [])
    }
  }

  const deleteKey = async (keyId: string) => {
    await fetch('/api/keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyId }),
    })
    setKeys(keys.filter((k) => k.id !== keyId))
  }

  if (!isLocalMode && status !== 'authenticated') return null

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <nav className="w-52 shrink-0 border-r border-border bg-muted/30 overflow-y-auto">
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-sm font-semibold text-foreground">设置</h1>
        </div>
        <div className="px-2 space-y-0.5">
          {getTabs(isLocalMode).map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {activeTab === 'ai' && <AiConfigSection />}

          {activeTab === 'api-keys' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
                <button
                  onClick={createKey}
                  className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> New Key
                </button>
              </div>

              {newKey && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
                    New API Key (save this now — it won&apos;t be shown again)
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs break-all text-green-700 dark:text-green-400 flex-1">{newKey}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(newKey)}
                      className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/40"
                    >
                      <Copy className="w-4 h-4 text-green-600" />
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : keys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No API keys yet.</p>
              ) : (
                <div className="space-y-2">
                  {keys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-mono">{key.keyPrefix}...</p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(key.createdAt).toLocaleDateString()}
                          {key.lastUsedAt && ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteKey(key.id)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Use the API key with the sync agent:
                </p>
                <code className="block mt-2 text-xs bg-muted p-2 rounded">
                  npx codememory-sync init
                </code>
                <p className="text-xs text-muted-foreground mt-1">
                  Then enter your server URL and the API key above.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">关于 CodeMemory</h2>
              <div className="p-4 bg-muted/30 rounded-lg space-y-2 text-sm text-muted-foreground">
                <p><strong className="text-foreground">版本</strong> 0.7.3</p>
                <p><strong className="text-foreground">模式</strong> 本地桌面版</p>
                <p>AI Coding 会话历史查看器，支持本地模式和云端模式。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
