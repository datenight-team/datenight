// src/app/settings/page.tsx
import { prisma } from '@/lib/db'
import { ALL_DB_KEYS } from '@/lib/config'
import { SettingsForm } from '@/components/settings-form'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const rows = await prisma.setting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const initialValues = Object.fromEntries(ALL_DB_KEYS.map((k) => [k, map[k] ?? '']))

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-amber-900 mb-1">Settings</h1>
      <p className="text-sm text-amber-600 mb-8">Configure your Date Night app.</p>
      <SettingsForm initialValues={initialValues} />
    </div>
  )
}
