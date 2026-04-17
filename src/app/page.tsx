// src/app/page.tsx
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const count = await prisma.setting.count()
  if (count === 0) {
    redirect('/setup')
  }
  redirect('/watchlist')
}
