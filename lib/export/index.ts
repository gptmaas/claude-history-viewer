import type { SessionDetail } from '@/lib/types'
import { exportToMarkdown } from './markdown-exporter'
import { exportToHTML } from './html-exporter'

export type ExtendedExportFormat = 'md' | 'json' | 'html' | 'pdf'

export function exportSession(detail: SessionDetail, format: ExtendedExportFormat): string | null {
  switch (format) {
    case 'md':
      return exportToMarkdown(detail)
    case 'json':
      return JSON.stringify(detail, null, 2)
    case 'html':
      return exportToHTML(detail)
    case 'pdf':
      return exportToHTML(detail, true)
    default:
      return null
  }
}

export { exportToMarkdown } from './markdown-exporter'
export { exportToHTML } from './html-exporter'
