'use client'

import { CheckCircle2, Circle, File, FileText } from 'lucide-react'
import { MarkdownRenderer } from './markdown-renderer'

interface ToolUseViewerProps {
  content: string
  data: unknown
  className?: string
}

interface ParsedToolUse {
  name: string
  input: Record<string, unknown>
  originalContent: string
}

function parseToolUse(content: string, data: unknown): ParsedToolUse | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed.type === 'tool_use' || parsed.type === 'server_tool_use') {
      return {
        name: parsed.name || 'Tool',
        input: parsed.input || {},
        originalContent: content
      }
    }
  } catch {
    // Not valid JSON
  }
  return null
}

// Simple word-based diff highlighting
function highlightDiff(oldText: string, newText: string): { old: JSX.Element[], new: JSX.Element[] } {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  const oldHighlighted = oldLines.map((line, i) => {
    const isChanged = !newLines.includes(line)
    return (
      <div key={i} className={`px-2 py-0.5 ${isChanged ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' : ''}`}>
        {line || '\u00A0'}
      </div>
    )
  })

  const newHighlighted = newLines.map((line, i) => {
    const isNew = !oldLines.includes(line)
    return (
      <div key={i} className={`px-2 py-0.5 ${isNew ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : ''}`}>
        {line || '\u00A0'}
      </div>
    )
  })

  return { old: oldHighlighted, new: newHighlighted }
}

// Render TodoWrite as a table
function renderTodoWrite(input: Record<string, unknown>): JSX.Element {
  const todos = input.todos as Array<{ content: string; status: string; activeForm: string }> || []

  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Status</th>
            <th className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300">Content</th>
          </tr>
        </thead>
        <tbody>
          {todos.map((todo, index) => (
            <tr key={index} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 px-3">
                {todo.status === 'completed' ? (
                  <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {todo.status}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Circle className="w-4 h-4" />
                    {todo.status}
                  </span>
                )}
              </td>
              <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{todo.content}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Render Edit with diff view
function renderEdit(input: Record<string, unknown>): JSX.Element {
  const oldString = String(input.old_string || '')
  const newString = String(input.new_string || '')
  const diff = highlightDiff(oldString, newString)

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Old String:</div>
        <pre className="bg-slate-100 dark:bg-slate-800 rounded p-3 text-xs overflow-x-auto max-w-full">
          {diff.old}
        </pre>
      </div>
      <div>
        <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">New String:</div>
        <pre className="bg-slate-100 dark:bg-slate-800 rounded p-3 text-xs overflow-x-auto max-w-full">
          {diff.new}
        </pre>
      </div>
    </div>
  )
}

// Get file icon and syntax highlighting language based on extension
function getFileLanguage(filename: string): { icon: string; lang: string; renderMarkdown: boolean } {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  const markdownExts = ['md', 'markdown', 'mdx']
  const codeExts: Record<string, string> = {
    'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
    'py': 'python', 'rb': 'ruby', 'go': 'go', 'rs': 'rust',
    'java': 'java', 'kt': 'kotlin', 'swift': 'swift', 'cpp': 'cpp', 'c': 'c', 'h': 'c',
    'cs': 'csharp', 'php': 'php', 'scala': 'scala', 'sh': 'bash', 'bash': 'bash',
    'css': 'css', 'scss': 'scss', 'less': 'less', 'html': 'html', 'htm': 'html',
    'xml': 'xml', 'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'toml': 'toml',
    'sql': 'sql', 'graphql': 'graphql', 'dockerfile': 'dockerfile'
  }

  if (markdownExts.includes(ext)) {
    return { icon: '📝', lang: 'markdown', renderMarkdown: true }
  }

  const lang = codeExts[ext] || 'text'
  return { icon: '📄', lang, renderMarkdown: false }
}

// Render Write tool with file content
function renderWrite(input: Record<string, unknown>): JSX.Element {
  const filePath = String(input.file_path || '')
  const fileContent = String(input.content || '')
  const filename = filePath.split('/').pop() || filePath
  const { icon, lang, renderMarkdown } = getFileLanguage(filename)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
        <File className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{filename}</span>
        <span className="text-xs text-slate-500">{filePath}</span>
      </div>
      {renderMarkdown ? (
        <MarkdownRenderer content={fileContent} />
      ) : (
        <pre className="bg-slate-100 dark:bg-slate-800 p-3 rounded text-xs overflow-x-auto max-w-full whitespace-pre">
          <code className={`language-${lang}`}>{fileContent}</code>
        </pre>
      )}
    </div>
  )
}

// Render ExitPlanMode tool - display plan as markdown
function renderExitPlanMode(input: Record<string, unknown>): JSX.Element {
  const plan = String(input.plan || '')

  return (
    <div className="space-y-2">
      <div className="pb-2 border-b border-slate-200 dark:border-slate-700">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Plan</span>
      </div>
      <MarkdownRenderer content={plan} />
    </div>
  )
}

// Render AskUserQuestion tool - display questions and options
function renderAskUserQuestion(input: Record<string, unknown>): JSX.Element {
  const questions = input.questions as Array<{
    question: string
    header: string
    options: Array<{
      label: string
      description: string
    }>
    [key: string]: unknown
  }> || []

  const firstQuestion = questions[0]

  if (!firstQuestion) {
    return <div className="text-slate-500">No question data found</div>
  }

  // Get all fields from options to display in table
  const optionFields = firstQuestion.options && firstQuestion.options.length > 0
    ? Object.keys(firstQuestion.options[0])
    : []

  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="pb-3 border-b border-slate-200 dark:border-slate-700">
        {firstQuestion.header && (
          <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">{firstQuestion.header}</div>
        )}
        <div className="text-base font-medium text-slate-800 dark:text-slate-200">{firstQuestion.question}</div>
      </div>

      {/* Options Table */}
      {firstQuestion.options && firstQuestion.options.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Options</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                {optionFields.map((field) => (
                  <th key={field} className="text-left py-2 px-3 font-medium text-slate-700 dark:text-slate-300 capitalize">
                    {field}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {firstQuestion.options.map((option, index) => (
                <tr key={index} className="border-b border-slate-100 dark:border-slate-800">
                  {optionFields.map((field) => (
                    <td key={field} className="py-2 px-3 text-slate-700 dark:text-slate-300">
                      {String(option[field as keyof typeof option] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Other properties */}
      <div>
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Other Properties</div>
        <div className="bg-slate-100 dark:bg-slate-800 rounded p-3">
          <pre className="text-xs whitespace-pre-wrap break-words">
            {syntaxHighlightJSON(JSON.stringify(
              Object.fromEntries(
                Object.entries(firstQuestion).filter(([key]) =>
                  key !== 'question' && key !== 'header' && key !== 'options'
                )
              ),
              null,
              2
            ))}
          </pre>
        </div>
      </div>
    </div>
  )
}

// Render Bash tool - display command with bash syntax highlighting
function renderBash(input: Record<string, unknown>): JSX.Element {
  const description = String(input.description || '')
  const command = String(input.command || '')

  return (
    <div className="space-y-2">
      {description && (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          {description}
        </div>
      )}
      <pre className="bg-slate-900 dark:bg-slate-950 rounded p-3 text-xs overflow-x-auto max-w-full whitespace-pre">
        <code className="language-bash text-slate-100 dark:text-slate-100">{command}</code>
      </pre>
    </div>
  )
}

// Render Task tool - display subagent info and prompt
function renderTask(input: Record<string, unknown>): JSX.Element {
  const description = String(input.description || '')
  const subagentType = String(input.subagent_type || '')
  const prompt = String(input.prompt || '')

  return (
    <div className="space-y-3">
      {(description || subagentType) && (
        <div className="pb-2 border-b border-slate-200 dark:border-slate-700 space-y-1">
          {description && (
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Description: </span>
              <span className="text-xs text-slate-700 dark:text-slate-300">{description}</span>
            </div>
          )}
          {subagentType && (
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Subagent Type: </span>
              <span className="text-xs text-purple-600 dark:text-purple-400">{subagentType}</span>
            </div>
          )}
        </div>
      )}
      <div>
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Prompt:</div>
        <pre className="bg-slate-100 dark:bg-slate-800 rounded p-3 text-xs overflow-x-auto max-w-full whitespace-pre-wrap">
          {prompt}
        </pre>
      </div>
    </div>
  )
}

// Syntax highlight JSON
function syntaxHighlightJSON(json: string): JSX.Element {
  const highlighted = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const colored = highlighted
    // Keys (blue) - strings followed by colon
    .replace(/"([^"]+)":/g, '<span class="text-blue-600 dark:text-blue-400">"$1"</span>:')
    // String values (green) - strings in values (after colon)
    .replace(/:\s*"([^"]*)"/g, ': <span class="text-green-600 dark:text-green-400">"$1"</span>')
    // Numbers (amber)
    .replace(/:\s*(\d+)/g, ': <span class="text-amber-600 dark:text-amber-400">$1</span>')
    // Booleans and null (purple)
    .replace(/:\s*(true|false|null)/g, ': <span class="text-purple-600 dark:text-purple-400">$1</span>')
    // Brackets (grey)
    .replace(/[\[\]]/g, '<span class="text-slate-500 dark:text-slate-400">$&</span>')
    .replace(/[{}]/g, '<span class="text-slate-500 dark:text-slate-400">$&</span>')

  return <span dangerouslySetInnerHTML={{ __html: colored }} />
}

export function ToolUseViewer({ content, data, className = '' }: ToolUseViewerProps) {
  const toolInfo = parseToolUse(content, data)

  if (toolInfo) {
    let formattedContent: React.ReactNode = null

    // Handle special tool rendering
    switch (toolInfo.name) {
      case 'TodoWrite':
        formattedContent = renderTodoWrite(toolInfo.input)
        break
      case 'Edit':
        formattedContent = renderEdit(toolInfo.input)
        break
      case 'Write':
        formattedContent = renderWrite(toolInfo.input)
        break
      case 'ExitPlanMode':
        formattedContent = renderExitPlanMode(toolInfo.input)
        break
      case 'AskUserQuestion':
        formattedContent = renderAskUserQuestion(toolInfo.input)
        break
      case 'Bash':
        formattedContent = renderBash(toolInfo.input)
        break
      case 'Task':
        formattedContent = renderTask(toolInfo.input)
        break
      default:
        // Default JSON rendering with syntax highlighting
        const jsonStr = JSON.stringify(toolInfo.input, null, 2)
        formattedContent = (
          <pre className="text-xs font-mono whitespace-pre-wrap break-words">
            {syntaxHighlightJSON(jsonStr)}
          </pre>
        )
    }

    return (
      <div className={`tool-use-viewer ${className}`}>
        <div className="bg-slate-50 dark:bg-slate-900 rounded p-4">
          {formattedContent}
        </div>
      </div>
    )
  }

  return null
}

interface ThinkingViewerProps {
  content: unknown
  className?: string
}

export function ThinkingViewer({ content, className = '' }: ThinkingViewerProps) {
  if (typeof content === 'object' && content !== null && 'type' in content && content.type === 'thinking') {
    const thinkingStr = String((content as any).thinking || '')

    return (
      <div className={`bg-slate-100 dark:bg-slate-800 rounded p-3 my-2 ${className}`}>
        <MarkdownRenderer content={thinkingStr} />
      </div>
    )
  }

  return null
}

interface ToolResultViewerProps {
  content: unknown
  className?: string
}

export function ToolResultViewer({ content, className = '' }: ToolResultViewerProps) {
  if (typeof content === 'string') {
    let displayContent = content
    if (content.length > 200) {
      displayContent = content.substring(0, 200) + '...'
    }

    return (
      <details className="group bg-green-50 dark:bg-green-900/20 rounded p-3 my-2">
        <summary className="cursor-pointer text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span>Tool Result</span>
          <span className="text-slate-500 dark:text-slate-400 text-xs ml-auto">
            ({content.length} chars)
          </span>
        </summary>
        <pre className="mt-2 text-xs whitespace-pre-wrap break-words max-w-full overflow-x-auto">
          {displayContent}
        </pre>
      </details>
    )
  }

  if (typeof content === 'object' && content !== null) {
    const contentStr = JSON.stringify(content, null, 2)
    return (
      <details className="group bg-green-50 dark:bg-green-900/20 rounded p-3 my-2">
        <summary className="cursor-pointer text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          <span>Tool Result</span>
        </summary>
        <pre className="mt-2 text-xs whitespace-pre-wrap break-words max-w-full overflow-x-auto">
          {contentStr}
        </pre>
      </details>
    )
  }

  return null
}
