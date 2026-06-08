'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface AddReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (result: string, comment: string) => void
}

export function AddReviewDialog({ open, onOpenChange, onSubmit }: AddReviewDialogProps) {
  const [result, setResult] = useState('approved')
  const [comment, setComment] = useState('')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">添加评审</h3>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">评审结果</label>
            <div className="flex gap-2 mt-2">
              {[
                { value: 'approved', label: '通过', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
                { value: 'rejected', label: '驳回', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
                { value: 'needs_changes', label: '需修改', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setResult(opt.value)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${result === opt.value ? opt.color : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">评论</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-sm min-h-[80px]"
              placeholder="评审意见..."
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
              onSubmit(result, comment)
              setResult('approved')
              setComment('')
              onOpenChange(false)
            }}
            className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            提交
          </button>
        </div>
      </div>
    </div>
  )
}
