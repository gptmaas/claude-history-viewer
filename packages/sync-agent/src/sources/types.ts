export interface DiscoveredFile {
  relativePath: string
  absolutePath: string
  mtime: number
  size: number
}

export interface ConversationSource {
  readonly name: string
  readonly label: string
  readonly watchDir: string
  discoverFiles(): DiscoveredFile[]
}
