export function isDesktopMode(): boolean {
  return process.env.DATA_SOURCE_MODE === 'local-desktop'
}

export function isDesktopClient(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== 'undefined'
}
