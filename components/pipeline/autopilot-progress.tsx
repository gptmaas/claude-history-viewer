'use client'

import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, Loader2, AlertTriangle, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export interface AutopilotStep {
  stageKey: string
  stageTitle: string
  generateType: string
  label: string
  status: 'pending' | 'running' | 'done' | 'failed'
  artifactName?: string
  reviewResult?: string
  risks?: Array<{ level: string; message: string }>
}

export interface AutopilotState {
  running: boolean
  steps: AutopilotStep[]
  currentStageKey: string | null
  stoppedReason: string | null
  completed: boolean
  error: string | null
}

export const initialAutopilotState: AutopilotState = {
  running: false,
  steps: [],
  currentStageKey: null,
  stoppedReason: null,
  completed: false,
  error: null,
}

const ALL_STEPS: Array<{ stageKey: string; stageTitle: string; generateType: string; label: string }> = [
  { stageKey: 'idea', stageTitle: '需求想法', generateType: 'requirement', label: 'AI 补全需求' },
  { stageKey: 'product_design_review', stageTitle: '方案设计', generateType: 'product_design', label: '生成产品方案' },
  { stageKey: 'product_design_review', stageTitle: '方案设计', generateType: 'product_review', label: '生成产品评审' },
  { stageKey: 'technical_design_review', stageTitle: '技术方案', generateType: 'technical_design', label: '生成技术方案' },
  { stageKey: 'technical_design_review', stageTitle: '技术方案', generateType: 'task_breakdown', label: '生成任务拆分' },
  { stageKey: 'technical_design_review', stageTitle: '技术方案', generateType: 'tech_review', label: '生成技术评审' },
  { stageKey: 'technical_design_review', stageTitle: '技术方案', generateType: 'test_plan', label: '生成测试计划' },
]

export function initializeSteps(): AutopilotStep[] {
  return ALL_STEPS.map(s => ({
    stageKey: s.stageKey,
    stageTitle: s.stageTitle,
    generateType: s.generateType,
    label: s.label,
    status: 'pending',
  }))
}

interface AutopilotProgressProps {
  state: AutopilotState
  onCancel: () => void
}

export function AutopilotProgress({ state, onCancel }: AutopilotProgressProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!state.running && !state.stoppedReason && !state.completed && !state.error) return null

  const currentStepIndex = state.steps.findIndex(s => s.status === 'running')
  const doneCount = state.steps.filter(s => s.status === 'done').length
  const totalSteps = state.steps.length

  return (
    <div className="border border-primary/20 rounded-lg bg-primary/[0.03] dark:bg-primary/[0.06] overflow-hidden fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-primary/[0.06] dark:bg-primary/[0.1] border-b border-primary/10">
        <div className="flex items-center gap-2">
          {state.running ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          ) : state.completed ? (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          ) : state.stoppedReason ? (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          ) : state.error ? (
            <XCircle className="w-4 h-4 text-red-500" />
          ) : (
            <Zap className="w-4 h-4 text-primary" />
          )}
          <span className="text-xs font-semibold text-foreground">
            Auto Pilot
          </span>
          <span className="text-[10px] text-muted-foreground">
            {state.running ? `${doneCount}/${totalSteps} 完成` :
             state.completed ? '全部完成' :
             state.stoppedReason ? '已暂停' :
             state.error ? '出错' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {state.running && (
            <button
              onClick={onCancel}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              取消
            </button>
          )}
          <button onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Stopped reason */}
      {state.stoppedReason && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200/50 dark:border-amber-800/30">
          <p className="text-xs text-amber-700 dark:text-amber-300">{state.stoppedReason}</p>
        </div>
      )}

      {/* Error */}
      {state.error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/10 border-b border-red-200/50 dark:border-red-800/30">
          <p className="text-xs text-red-700 dark:text-red-300">{state.error}</p>
        </div>
      )}

      {/* Progress */}
      {!collapsed && (
        <div className="px-4 py-3 space-y-1.5 max-h-[300px] overflow-y-auto">
          {state.steps.map((step, i) => (
            <div key={`${step.stageKey}-${step.generateType}`} className="flex items-center gap-2">
              {step.status === 'pending' && (
                <div className="w-4 h-4 rounded-full border border-muted-foreground/25 flex items-center justify-center shrink-0">
                  <span className="text-[8px] text-muted-foreground/40">{i + 1}</span>
                </div>
              )}
              {step.status === 'running' && (
                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              )}
              {step.status === 'done' && (
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
              {step.status === 'failed' && (
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'text-[11px]',
                  step.status === 'pending' && 'text-muted-foreground/50',
                  step.status === 'running' && 'text-foreground font-medium',
                  step.status === 'done' && 'text-muted-foreground',
                  step.status === 'failed' && 'text-red-600 dark:text-red-400',
                )}>
                  {step.label}
                </span>
                {step.artifactName && step.status === 'done' && (
                  <span className="text-[10px] text-muted-foreground ml-1.5">{step.artifactName}</span>
                )}
              </div>
              {step.reviewResult && (
                <span className={cn(
                  'text-[10px] font-medium px-1.5 py-0.5 rounded',
                  step.reviewResult === 'approved'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
                )}>
                  {step.reviewResult === 'approved' ? '通过' : '需修改'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
