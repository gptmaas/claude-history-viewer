interface HighlightedSnippetProps {
  headline?: string
  snippet: string
  className?: string
}

export function HighlightedSnippet({ headline, snippet, className = '' }: HighlightedSnippetProps) {
  if (headline) {
    return (
      <span
        className={className}
        dangerouslySetInnerHTML={{ __html: headline }}
      />
    )
  }

  return <span className={className}>{snippet}</span>
}
