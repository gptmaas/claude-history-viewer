'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'

const noSidebarPaths = ['/login', '/register', '/share']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showSidebar = !noSidebarPaths.some((p) => pathname.startsWith(p))

  if (!showSidebar) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
