// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { MobileHeader } from '@/components/mobile-header'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'

export const metadata: Metadata = {
  title: 'Date Night',
  description: 'Our Criterion Collection watchlist',
}

const THEME_SCRIPT = `
try {
  var stored = localStorage.getItem('theme');
  if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Work+Sans:wght@400;500;600;700&display=swap" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex flex-col h-screen">
        <MobileHeader />
        <div className="flex flex-1 overflow-hidden bg-background">
          <div className="hidden md:flex h-full">
            <Sidebar />
          </div>
          <main
            className="flex-1 overflow-y-auto pb-20 md:pb-0"
            style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {children}
          </main>
        </div>
        <MobileBottomNav />
      </body>
    </html>
  )
}
