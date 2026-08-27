// src/app/setup/page.tsx
import { Clapperboard } from 'lucide-react'
import { prisma } from '@/lib/db'
import { ALL_DB_KEYS } from '@/lib/config'
import { SettingsForm } from '@/components/settings-form'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const rows = await prisma.setting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const initialValues = Object.fromEntries(ALL_DB_KEYS.map((k) => [k, map[k] ?? '']))

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-8 p-5 bg-downloading-bg border border-border rounded-xl">
        <h1 className="text-2xl font-display font-bold text-foreground mb-1 flex items-center gap-2">
          Welcome to Date Night <Clapperboard className="w-5 h-5 text-primary" aria-hidden="true" />
        </h1>
        <p className="text-sm text-muted-foreground">
          Let&apos;s get you set up. Fill in the services you use — everything optional except the TMDB API key, which is needed to add movies.
        </p>
      </div>
      <SettingsForm
        initialValues={initialValues}
        redirectTo="/watchlist"
        submitLabel="Save & Get Started"
      />
    </div>
  )
}
