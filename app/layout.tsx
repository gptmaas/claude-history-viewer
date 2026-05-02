import type { Metadata } from "next"
// import { Inter } from "next/font/google"
import "./globals.css"

// 临时注释Google字体，使用系统字体
// const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Claude Code History Viewer",
  description: "View and search your Claude Code conversation history",
  icons: {
    icon: '/icon.png',
    shortcut: '/favicon.png',
    apple: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  )
}
