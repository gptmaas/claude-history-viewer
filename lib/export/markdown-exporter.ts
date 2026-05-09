import type { SessionDetail, Message } from '@/lib/types'
import { contentToString } from './content-utils'

export function exportToMarkdown(detail: SessionDetail): string {
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

  // Metadata header
  let md = `---\n`
  md += `title: "${session.display.replace(/"/g, '\\"')}"\n`
  md += `project: "${session.projectName}"\n`
  md += `date: ${session.date instanceof Date ? session.date.toISOString() : session.date}\n`
  md += `messages: ${messages.length}\n`
  if (toolCounts.size > 0) {
    md += `tools:\n`
    for (const [name, count] of toolCounts) {
      md += `  - ${name} (${count}x)\n`
    }
  }
  md += `---\n\n`

  md += `# ${session.display}\n\n`
  md += `**Project:** ${session.projectName}  \n`
  md += `**Date:** ${session.date instanceof Date ? session.date.toLocaleString() : session.date}  \n`
  md += `**Messages:** ${messages.length}\n\n`

  // Tool summary
  if (toolCounts.size > 0) {
    md += `**Tools:** ${Array.from(toolCounts.entries()).map(([n, c]) => `${n}×${c}`).join(', ')}\n\n`
  }

  md += `---\n\n`

  // Table of Contents for long sessions
  if (messages.length > 10) {
    md += `## Table of Contents\n\n`
    let userMsgIndex = 0
    for (const msg of messages) {
      if (msg.type === 'user') {
        userMsgIndex++
        const preview = contentToString(msg.content).slice(0, 60).replace(/[\n\r]/g, ' ')
        const anchor = `user-${userMsgIndex}`
        md += `${userMsgIndex}. [${preview}${preview.length >= 60 ? '...' : ''}](#${anchor})\n`
      }
    }
    md += `\n---\n\n`
  }

  // Messages
  let userMsgIndex = 0
  for (const msg of messages) {
    if (msg.type === 'user') {
      userMsgIndex++
      md += `<a id="user-${userMsgIndex}"></a>\n\n`
      md += `## 👤 User\n\n${contentToString(msg.content)}\n\n`
    } else if (msg.type === 'assistant') {
      md += `## 🤖 Assistant\n\n${contentToString(msg.content)}\n\n`
    } else if (msg.type === 'tool_use') {
      const toolName = extractToolName(msg)
      const content = contentToString(msg.content)
      md += `<details>\n<summary>🔧 Tool Use${toolName ? `: ${toolName}` : ''}</summary>\n\n\`\`\`json\n${content}\n\`\`\`\n\n</details>\n\n`
    } else if (msg.type === 'tool_result') {
      const content = contentToString(msg.content)
      md += `<details>\n<summary>📋 Tool Result</summary>\n\n\`\`\`\n${content}\n\`\`\`\n\n</details>\n\n`
    }
  }

  return md
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
