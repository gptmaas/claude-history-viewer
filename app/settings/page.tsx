'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Plus, Trash2 } from 'lucide-react'

interface ApiKeyInfo {
  id: string
  keyPrefix: string
  name: string
  lastUsedAt: string | null
  createdAt: string
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [keys, setKeys] = useState<ApiKeyInfo[]>([])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/keys')
      .then((r) => r.json())
      .then((data) => {
        setKeys(data.keys ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [status])

  const createKey = async () => {
    const res = await fetch('/api/keys', { method: 'POST' })
    const data = await res.json()
    if (data.apiKey) {
      setNewKey(data.apiKey)
      // Refresh list
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

  if (status !== 'authenticated') return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-6">
          Settings
        </h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>API Keys</span>
              <button
                onClick={createKey}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                New Key
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {newKey && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
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
              <p className="text-sm text-slate-500">Loading...</p>
            ) : keys.length === 0 ? (
              <p className="text-sm text-slate-500">No API keys yet.</p>
            ) : (
              <div className="space-y-2">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-mono">{key.keyPrefix}...</p>
                      <p className="text-xs text-slate-500">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt && ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteKey(key.id)}
                      className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Use the API key with the sync agent:
          </p>
          <code className="block mt-2 text-xs bg-slate-200 dark:bg-slate-700 p-2 rounded">
            npx codememory-sync init
          </code>
          <p className="text-xs text-slate-500 mt-1">
            Then enter your server URL and the API key above.
          </p>
        </div>
      </div>
    </div>
  )
}
