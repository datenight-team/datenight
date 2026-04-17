// src/app/setup/page.tsx
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
      <div className="mb-8 p-5 bg-amber-100 border border-amber-300 rounded-xl">
        <h1 className="text-2xl font-bold text-amber-900 mb-1">Welcome to Date Night 🎬</h1>
        <p className="text-sm text-amber-700">
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
