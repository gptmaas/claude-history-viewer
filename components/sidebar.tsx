'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  FolderOpen,
  MessageSquare,
  Search,
  Settings,
  LogOut,
  Cpu,
  Sun,
  Moon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: '概览', icon: LayoutDashboard },
  { href: '/projects', label: '项目', icon: FolderOpen },
  { href: '/sessions', label: '会话', icon: MessageSquare },
  { href: '/search', label: '搜索', icon: Search },
]

function useTheme() {
  const toggle = () => {
    const isDark = document.documentElement.classList.contains('dark')
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    }
  }
  return { toggle }
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { toggle: toggleTheme } = useTheme()

  return (
    <aside className="w-[240px] h-screen flex flex-col bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))] shrink-0 select-none">
      {/* Brand */}
      <div className="px-4 h-14 flex items-center gap-3 border-b border-[hsl(var(--sidebar-border))]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Cpu className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-[13px] font-semibold text-foreground tracking-tight">
            CodeMemory
          </h1>
          <p className="text-[10px] text-muted-foreground leading-none mt-px">
            AI Coding Analytics
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-[7px] rounded-md text-[13px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <item.icon
                className={cn(
                  'w-[15px] h-[15px]',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              {item.label}
              {isActive && (
                <div className="ml-auto w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-3 border-t border-[hsl(var(--sidebar-border))]">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-[7px] rounded-md text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-150 mb-1"
        >
          <Sun className="w-[15px] h-[15px] dark:hidden" />
          <Moon className="w-[15px] h-[15px] hidden dark:block" />
          <span className="dark:hidden">浅色模式</span>
          <span className="hidden dark:inline">深色模式</span>
        </button>

        {session ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-md">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-[10px] font-semibold text-white">
              {session.user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-foreground truncate">
                {session.user?.name || session.user?.email?.split('@')[0]}
              </p>
              <p className="text-[10px] text-muted-foreground truncate leading-tight">
                {session.user?.email}
              </p>
            </div>
            <div className="flex items-center gap-0.5">
              <Link
                href="/settings"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => signOut()}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 transition-colors"
          >
            Login
          </Link>
        )}
      </div>
    </aside>
  )
}
