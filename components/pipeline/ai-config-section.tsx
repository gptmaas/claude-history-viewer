'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Settings2 } from 'lucide-react'

interface AiConfig {
  id: number
  name: string
  description: string | null
  provider: string
  apiKey: string
  apiKeySet: boolean
  baseUrl: string | null
  model: string
  isActive: number
  projectDir: string | null
}

const MODEL_PRESETS = [
  'claude-sonnet-4-6-20250627',
  'claude-opus-4-7-20250618',
  'claude-haiku-4-5-20251001',
]

function cn(...inputs: (string | boolean | undefined | null)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function AiConfigSection() {
  const [configs, setConfigs] = useState<AiConfig[]>([])
  const [editing, setEditing] = useState<AiConfig | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', provider: 'anthropic',
    apiKey: '', baseUrl: '', model: MODEL_PRESETS[0], projectDir: '',
  })

  const fetchConfigs = async () => {
    const res = await fetch('/api/settings/ai')
    if (res.ok) setConfigs(await res.json())
  }

  useEffect(() => { fetchConfigs() }, [])

  const handleCreate = async () => {
    await fetch('/api/settings/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setIsCreating(false)
    setForm({ name: '', description: '', provider: 'anthropic', apiKey: '', baseUrl: '', model: MODEL_PRESETS[0], projectDir: '' })
    fetchConfigs()
  }

  const handleUpdate = async () => {
    if (!editing) return
    const body: Record<string, unknown> = { id: editing.id }
    if (form.name) body.name = form.name
    if (form.description !== undefined) body.description = form.description
    if (form.apiKey) body.apiKey = form.apiKey
    if (form.baseUrl !== undefined) body.baseUrl = form.baseUrl
    if (form.model) body.model = form.model
    if (form.projectDir !== undefined) body.projectDir = form.projectDir

    await fetch('/api/settings/ai', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setEditing(null)
    fetchConfigs()
  }

  const handleActivate = async (id: number) => {
    await fetch('/api/settings/ai', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: true }),
    })
    fetchConfigs()
  }

  const handleDelete = async (id: number) => {
    await fetch('/api/settings/ai', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchConfigs()
  }

  const startEdit = (config: AiConfig) => {
    setEditing(config)
    setForm({
      name: config.name,
      description: config.description ?? '',
      provider: config.provider,
      apiKey: '',
      baseUrl: config.baseUrl ?? '',
      model: config.model,
      projectDir: config.projectDir ?? '',
    })
    setIsCreating(false)
  }

  const startCreate = () => {
    setIsCreating(true)
    setEditing(null)
    setForm({ name: '', description: '', provider: 'anthropic', apiKey: '', baseUrl: '', model: MODEL_PRESETS[0], projectDir: '' })
  }

  const showForm = isCreating || editing

  return (
    <div className="bg-card rounded-xl border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">AI 配置</h2>
        </div>
        <button
          onClick={startCreate}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> 新增配置
        </button>
      </div>

      {showForm && (
        <div className="p-3 bg-muted/50 rounded-lg space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">名称</label>
            <input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              placeholder="例如：默认配置"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">描述</label>
            <input
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              placeholder="可选备注"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Provider</label>
              <select
                value={form.provider}
                disabled
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-muted text-sm"
              >
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Model</label>
              <select
                value={MODEL_PRESETS.includes(form.model) ? form.model : '__custom__'}
                onChange={(e) => {
                  if (e.target.value !== '__custom__') {
                    setForm(f => ({ ...f, model: e.target.value }))
                  }
                }}
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              >
                {MODEL_PRESETS.map(m => <option key={m} value={m}>{m}</option>)}
                <option value="__custom__">自定义...</option>
              </select>
              {!MODEL_PRESETS.includes(form.model) && (
                <input
                  value={form.model}
                  onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
                  placeholder="自定义模型名称"
                />
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              API Key {editing && editing.apiKeySet && <span className="text-muted-foreground">(已设置，留空保持不变)</span>}
            </label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm(f => ({ ...f, apiKey: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm font-mono"
              placeholder="sk-ant-..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Base URL <span className="text-muted-foreground">(可选，留空使用默认)</span></label>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm(f => ({ ...f, baseUrl: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              placeholder="https://api.anthropic.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">项目目录 <span className="text-muted-foreground">(用于技术方案扫描)</span></label>
            <input
              value={form.projectDir}
              onChange={(e) => setForm(f => ({ ...f, projectDir: e.target.value }))}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              placeholder="/path/to/project"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setIsCreating(false); setEditing(null) }}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              取消
            </button>
            <button
              onClick={isCreating ? handleCreate : handleUpdate}
              disabled={!form.name}
              className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isCreating ? '创建' : '保存'}
            </button>
          </div>
        </div>
      )}

      {configs.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">尚未配置 AI。点击上方按钮添加配置。</p>
      )}
      <div className="space-y-2">
        {configs.map((config) => (
          <div
            key={config.id}
            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{config.name}</span>
                {config.isActive ? (
                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded">活跃</span>
                ) : (
                  <button
                    onClick={() => handleActivate(config.id)}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border"
                  >
                    设为活跃
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                <span>{config.provider}</span>
                <span>{config.model}</span>
                <span>{config.apiKeySet ? 'Key ✓' : 'Key 未设置'}</span>
              </div>
              {config.description && <p className="text-xs text-muted-foreground mt-1">{config.description}</p>}
            </div>
            <div className="flex items-center gap-1 ml-3">
              <button
                onClick={() => startEdit(config)}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(config.id)}
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
