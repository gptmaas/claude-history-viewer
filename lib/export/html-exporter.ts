import type { SessionDetail, Message } from '@/lib/types'
import { escapeHtml, formatContent } from './content-utils'

export function exportToHTML(detail: SessionDetail, printMode = false): string {
  const { session, messages } = detail

  // Compute tool stats
  const toolCounts = new Map<string, number>()
  for (const msg of messages) {
    if (msg.type === 'tool_use') {
      const content = msg.content
      if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
        const obj = content as Record<string, unknown>
        if (obj.name && typeof obj.name === 'string') {
          toolCounts.set(obj.name, (toolCounts.get(obj.name) || 0) + 1)
        }
      }
    }
  }

  // Pre-compute user message indices
  let userIndex = 0
  const userMsgIds = new Map<number, number>()
  messages.forEach((msg, idx) => {
    if (msg.type === 'user') {
      userIndex++
      userMsgIds.set(idx, userIndex)
    }
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(session.display)}</title>
  <style>
    :root {
      --bg: #0a0c14;
      --surface: #12141f;
      --surface2: #1a1d2e;
      --border: #252840;
      --text: #e4e4ef;
      --text-dim: #8888a0;
      --blue: #3b82f6;
      --green: #22c55e;
      --amber: #f59e0b;
      --red: #ef4444;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 24px;
    }
    .container { max-width: 860px; margin: 0 auto; }
    h1 {
      font-size: 20px;
      font-weight: 600;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 16px;
    }
    .meta {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 13px;
      color: var(--text-dim);
      margin-bottom: 20px;
    }
    .meta span { display: flex; align-items: center; gap: 4px; }
    .tool-summary {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .tool-tag {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.15);
      color: var(--amber);
    }
    .message {
      margin: 16px 0;
      padding: 14px 16px;
      border-radius: 8px;
      font-size: 14px;
    }
    .msg-user { background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.12); }
    .msg-assistant { background: var(--surface); border: 1px solid var(--border); }
    .msg-role {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .msg-user .msg-role { color: var(--blue); }
    .msg-assistant .msg-role { color: var(--green); }
    .msg-content { word-break: break-word; white-space: pre-wrap; }
    details {
      margin: 8px 0;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
    }
    summary {
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 500;
      color: var(--amber);
      cursor: pointer;
      background: rgba(245, 158, 11, 0.05);
    }
    summary:hover { background: rgba(245, 158, 11, 0.1); }
    .details-content {
      padding: 12px;
      max-height: 400px;
      overflow: auto;
    }
    pre {
      background: #0d1117;
      border: 1px solid var(--border);
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 13px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
    }
    code {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
    }
    code:not(pre code) {
      background: rgba(59, 130, 246, 0.1);
      padding: 1px 5px;
      border-radius: 3px;
    }
    .toc {
      margin: 16px 0 24px;
      padding: 12px 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    .toc h3 { font-size: 13px; color: var(--text-dim); margin-bottom: 8px; }
    .toc ol { padding-left: 20px; }
    .toc li { font-size: 13px; margin: 4px 0; }
    .toc a { color: var(--blue); text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 12px;
      color: var(--text-dim);
    }
    .footer a { color: var(--blue); text-decoration: none; }

    /* Print styles */
    @media print {
      body { background: white; color: #222; padding: 0; }
      .container { max-width: 100%; }
      h1 { border-bottom-color: #ddd; }
      .meta { color: #666; }
      .message { break-inside: avoid; }
      .msg-user { background: #f0f7ff; border-color: #d0dfff; }
      .msg-assistant { background: #f8f8f8; border-color: #e0e0e0; }
      details { break-inside: avoid; }
      pre { background: #f5f5f5; border-color: #ddd; color: #333; }
      .footer { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(session.display)}</h1>
    <div class="meta">
      <span>📁 ${escapeHtml(session.projectName)}</span>
      <span>📅 ${session.date instanceof Date ? session.date.toLocaleString() : session.date}</span>
      <span>💬 ${messages.length} messages</span>
    </div>
    ${toolCounts.size > 0 ? `<div class="tool-summary">${Array.from(toolCounts.entries()).map(([name, count]) => `<span class="tool-tag">${escapeHtml(name)} ×${count}</span>`).join('')}</div>` : ''}
    ${messages.length > 10 ? generateToc(messages) : ''}
    ${messages.map((msg, idx) => renderMessage(msg, userMsgIds.get(idx))).join('\n')}
    <div class="footer">
      Exported from <a href="#">CodeMemory</a> — AI Coding Analytics
    </div>
  </div>${printMode ? '<script>window.onload=function(){window.print()}</script>' : ''}
</body>
</html>`

  return html
}

function generateToc(messages: Message[]): string {
  let idx = 0
  const items: string[] = []
  for (const msg of messages) {
    if (msg.type === 'user') {
      idx++
      const text = escapeHtml(extractTextPreview(msg.content))
      items.push(`<li><a href="#msg-${idx}">${text}</a></li>`)
    }
  }
  return `<div class="toc"><h3>Table of Contents</h3><ol>${items.join('\n')}</ol></div>`
}

function renderMessage(msg: Message, userMsgId?: number): string {
  if (msg.type === 'user') {
    const id = userMsgId ? ` id="msg-${userMsgId}"` : ''
    return `<div class="message msg-user"${id}>
      <div class="msg-role">👤 User</div>
      <div class="msg-content">${formatContent(msg.content)}</div>
    </div>`
  }
  if (msg.type === 'assistant') {
    return `<div class="message msg-assistant">
      <div class="msg-role">🤖 Assistant</div>
      <div class="msg-content">${formatContent(msg.content)}</div>
    </div>`
  }
  if (msg.type === 'tool_use') {
    const toolName = extractToolName(msg)
    return `<details>
      <summary>🔧 Tool Use${toolName ? `: ${escapeHtml(toolName)}` : ''}</summary>
      <div class="details-content"><pre><code>${escapeHtml(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2))}</code></pre></div>
    </details>`
  }
  if (msg.type === 'tool_result') {
    return `<details>
      <summary>📋 Tool Result</summary>
      <div class="details-content"><pre><code>${escapeHtml(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2))}</code></pre></div>
    </details>`
  }
  return ''
}

function extractToolName(msg: Message): string {
  if (msg.type !== 'tool_use') return ''
  const content = msg.content
  if (typeof content === 'object' && content !== null && !Array.isArray(content)) {
    const obj = content as Record<string, unknown>
    if (obj.name && typeof obj.name === 'string') return obj.name
  }
  return ''
}

function extractTextPreview(content: unknown): string {
  const text = typeof content === 'string' ? content : JSON.stringify(content)
  return text.slice(0, 80).replace(/[\n\r]/g, ' ')
}
