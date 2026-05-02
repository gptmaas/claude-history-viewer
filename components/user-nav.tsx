'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { Settings, LogOut } from 'lucide-react'

export function UserNav() {
  const { data: session, status } = useSession()

  // Only show in cloud mode
  if (process.env.NEXT_PUBLIC_DATA_SOURCE_MODE !== 'cloud') {
    return null
  }

  if (status === 'loading') return null

  if (!session) {
    return (
      <Link
        href="/login"
        className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
      >
        Login
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/settings"
        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Settings"
      >
        <Settings className="w-4 h-4 text-slate-600 dark:text-slate-400" />
      </Link>
      <span className="text-sm text-slate-600 dark:text-slate-400 max-w-[150px] truncate">
        {session.user.email}
      </span>
      <button
        onClick={() => signOut()}
        className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Sign out"
      >
        <LogOut className="w-4 h-4 text-slate-600 dark:text-slate-400" />
      </button>
    </div>
  )
}
