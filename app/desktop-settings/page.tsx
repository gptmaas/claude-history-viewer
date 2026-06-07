'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Plus, Trash2, FolderOpen, ToggleLeft, ToggleRight, FileText, RefreshCw, RotateCcw, CheckCircle, XCircle, Clock } from 'lucide-react'

interface SourceConfig {
  type: 'claude-code' | 'codex-cli'
  path: string
  enabled: boolean
}

interface DesktopConfig {
  mode: string
  sources: SourceConfig[]
  lastOpenedAt: string | null
  configFilePath?: string
}

interface IndexSourceStatus {
  id: number
  type: string
  path: string
  lastScanAt: number | null
  totalFiles: number
  parsedFiles: number
  failedFiles: number
}

interface IndexStatusData {
  sources: IndexSourceStatus[]
  totalSessions: number
  totalMessages: number
  lastRunAt: number | null
}

export default function DesktopSettingsPage() {
  const router = useRouter()
  const [config, setConfig] = useState<DesktopConfig | null>(null)
  const [indexStatus, setIndexStatus] = useState<IndexStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/desktop-config')
      const data = await res.json()
      setConfig(data)
    } catch {
      setMessage({ type: 'error', text: '加载配置失败' })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadIndexStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/index-status')
      if (res.ok) {
        const data = await res.json()
        setIndexStatus(data)
      }
    } catch {
      // Index status not available yet
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadIndexStatus()
  }, [loadConfig, loadIndexStatus])

  const saveConfig = async (sources: SourceConfig[]) => {
    setSaving(true)
    try {
      const res = await fetch('/api/desktop-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'local-desktop', sources, lastOpenedAt: null }),
      })
      if (res.ok) {
        setConfig((prev) => prev ? { ...prev, sources } : null)
        setMessage({ type: 'success', text: '配置已保存' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '保存失败' })
      }
    } catch {
      setMessage({ type: 'error', text: '保存配置失败' })
    } finally {
      setSaving(false)
    }
  }

  const toggleSource = (index: number) => {
    if (!config) return
    const sources = [...config.sources]
    sources[index] = { ...sources[index], enabled: !sources[index].enabled }
    saveConfig(sources)
  }

  const removeSource = (index: number) => {
    if (!config) return
    const sources = config.sources.filter((_, i) => i !== index)
    saveConfig(sources)
  }

  const addSource = async () => {
    let dirPath: string | null = null

    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        dirPath = await invoke<string>('pick_directory')
      } catch {
        // Dialog cancelled or not available
      }
    }

    if (!dirPath) {
      dirPath = prompt('请输入数据源目录路径（如 ~/.claude）：')
    }

    if (!dirPath) return

    try {
      const res = await fetch('/api/desktop-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dirPath }),
      })
      const data = await res.json()
      if (data.source) {
        const sources = [...(config?.sources || []), data.source]
        saveConfig(sources)
      } else {
        setMessage({ type: 'error', text: data.error || '无法识别该目录的数据源类型' })
        setTimeout(() => setMessage(null), 3000)
      }
    } catch {
      setMessage({ type: 'error', text: '验证目录失败' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const triggerScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/trigger-scan', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setMessage({ type: 'success', text: `扫描完成：${data.filesParsed} 文件已解析，${data.totalSessions} 会话，${data.totalMessages} 消息` })
        loadIndexStatus()
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '扫描失败' })
      }
    } catch {
      setMessage({ type: 'error', text: '触发扫描失败' })
    } finally {
      setScanning(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const triggerRebuild = async () => {
    if (!confirm('确定要重建索引吗？这将清除所有索引数据并重新解析所有文件。')) return
    setRebuilding(true)
    try {
      const res = await fetch('/api/rebuild-index', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setMessage({ type: 'success', text: `索引重建完成：${data.filesParsed} 文件，${data.totalSessions} 会话，${data.totalMessages} 消息` })
        loadIndexStatus()
      } else {
        const data = await res.json()
        setMessage({ type: 'error', text: data.error || '重建失败' })
      }
    } catch {
      setMessage({ type: 'error', text: '触发重建失败' })
    } finally {
      setRebuilding(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setMessage({ type: 'success', text: '已复制到剪贴板' })
    setTimeout(() => setMessage(null), 2000)
  }

  const formatTime = (ts: number | null) => {
    if (!ts) return '未扫描'
    return new Date(ts).toLocaleString('zh-CN')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">设置</h1>
        <button
          onClick={() => router.push('/')}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          返回 Dashboard
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>数据源</span>
            <button
              onClick={addSource}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              添加目录
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {config?.sources.length === 0 ? (
            <div className="text-center py-8">
              <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-1">未配置数据源</p>
              <p className="text-xs text-muted-foreground">
                点击「添加目录」选择 Claude Code 或 Codex CLI 的数据目录
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {config?.sources.map((source, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg"
                >
                  <button
                    onClick={() => toggleSource(index)}
                    className="shrink-0"
                    title={source.enabled ? '点击禁用' : '点击启用'}
                  >
                    {source.enabled ? (
                      <ToggleRight className="w-6 h-6 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-secondary font-mono">
                        {source.type === 'claude-code' ? 'Claude Code' : 'Codex CLI'}
                      </span>
                    </div>
                    <p className="text-sm text-foreground truncate mt-1">{source.path}</p>
                  </div>
                  <button
                    onClick={() => removeSource(index)}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 shrink-0"
                    title="移除数据源"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Index Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              索引状态
              {indexStatus && (
                <span className="text-xs text-muted-foreground font-normal">
                  {indexStatus.totalSessions} 会话 · {indexStatus.totalMessages} 消息
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={triggerScan}
                disabled={scanning}
                className="px-2.5 py-1 text-xs bg-secondary text-foreground rounded hover:bg-secondary/80 flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
                {scanning ? '扫描中...' : '扫描'}
              </button>
              <button
                onClick={triggerRebuild}
                disabled={rebuilding}
                className="px-2.5 py-1 text-xs bg-secondary text-foreground rounded hover:bg-secondary/80 flex items-center gap-1 disabled:opacity-50"
              >
                <RotateCcw className={`w-3 h-3 ${rebuilding ? 'animate-spin' : ''}`} />
                {rebuilding ? '重建中...' : '重建'}
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {indexStatus && indexStatus.sources.length > 0 ? (
            <div className="space-y-3">
              {indexStatus.sources.map((source) => (
                <div key={source.id} className="p-3 bg-secondary/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-secondary font-mono">
                        {source.type === 'claude-code' ? 'Claude Code' : 'Codex CLI'}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[300px]">{source.path}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3 text-muted-foreground" />
                      {source.totalFiles} 文件
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      {source.parsedFiles} 成功
                    </span>
                    {source.failedFiles > 0 && (
                      <span className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-red-500" />
                        {source.failedFiles} 失败
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatTime(source.lastScanAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              尚未建立索引。点击「扫描」开始索引数据源文件。
            </p>
          )}
        </CardContent>
      </Card>

      {/* Config File Location */}
      {config?.configFilePath && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">配置文件位置</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <code className="text-xs text-muted-foreground flex-1 break-all">
                {config.configFilePath}
              </code>
              <button
                onClick={() => copyToClipboard(config.configFilePath!)}
                className="p-1 rounded hover:bg-secondary shrink-0"
                title="复制路径"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {saving && (
        <div className="fixed bottom-4 right-4 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm shadow-lg">
          保存中...
        </div>
      )}
    </div>
  )
}
