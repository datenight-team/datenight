// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { MobileHeader } from '@/components/mobile-header'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Date Night',
  description: 'Our Criterion Collection watchlist',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex flex-col h-screen`}>
        <MobileHeader />
        <div className="flex flex-1 overflow-hidden bg-amber-50">
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
