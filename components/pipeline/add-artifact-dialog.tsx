'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface AddArtifactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string, artifactType: string, content: string) => void
}

export function AddArtifactDialog({ open, onOpenChange, onSubmit }: AddArtifactDialogProps) {
  const [name, setName] = useState('')
  const [artifactType, setArtifactType] = useState('markdown')
  const [content, setContent] = useState('')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">添加产物</h3>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
              placeholder="产物名称"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">类型</label>
            <select
              value={artifactType}
              onChange={(e) => setArtifactType(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
            >
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
              <option value="file_reference">文件引用</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm min-h-[200px] font-mono"
              placeholder="产物内容..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (name) {
                onSubmit(name, artifactType, content)
                setName('')
                setContent('')
                onOpenChange(false)
              }
            }}
            className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  )
}
