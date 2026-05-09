/**
 * Shared content conversion utilities for export modules.
 */

export function contentToString(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
      .map((block) => block.text)
      .join('\n\n')
  }
  if (typeof content === 'object' && content !== null) {
    if ('type' in content && content.type === 'thinking' && 'thinking' in content) {
      return String(content.thinking)
    }
    return JSON.stringify(content)
  }
  return ''
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function formatContent(content: unknown): string {
  const textContent = contentToString(content)
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  let result = escapeHtml(textContent)
  result = result.replace(codeBlockRegex, '<pre><code>$2</code></pre>')
  return result
}
