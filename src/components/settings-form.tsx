// src/components/settings-form.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Field {
  key: string
  label: string
  sensitive?: boolean
  placeholder?: string
  hint?: string
  hintUrl?: string
  hintLinkText?: string
  hintSuffix?: string
  badge?: 'required' | 'optional'
}

interface Row {
  fields: Field[]
}

interface Section {
  title: string
  icon: string
  description?: string
  rows: Row[]
}

const SECTIONS: Section[] = [
  {
    title: 'General',
    icon: '👥',
    rows: [
      {
        fields: [
          { key: 'user1_name', label: 'User 1 Name', placeholder: 'User 1', hint: 'Name shown on rating buttons' },
          { key: 'user2_name', label: 'User 2 Name', placeholder: 'User 2', hint: 'Name shown on rating buttons' },
        ],
      },
    ],
  },
  {
    title: 'TMDB',
    icon: '🎬',
    description: 'Required for Add Movie',
    rows: [
      {
        fields: [
          {
            key: 'tmdb_api_key',
            label: 'API Key',
            sensitive: true,
            badge: 'required',
            hint: 'Get a free key at',
            hintUrl: 'https://developer.themoviedb.org/docs/getting-started',
            hintLinkText: 'themoviedb.org',
          },
        ],
      },
    ],
  },
  {
    title: 'Seerr',
    icon: '📥',
    description: 'Optional — for auto-requesting downloads',
    rows: [
      {
        fields: [
          { key: 'seerr_url', label: 'Server URL', placeholder: 'http://seerr:5055', hint: 'Internal server URL (for API calls)' },
          { key: 'seerr_public_url', label: 'Public URL', placeholder: 'http://192.168.1.x:5055', hint: 'Browser-accessible URL for links in UI', badge: 'optional' },
        ],
      },
      {
        fields: [
          { key: 'seerr_api_key', label: 'API Key', sensitive: true, hint: 'Settings → API Key in Seerr UI' },
          { key: 'seerr_concurrency', label: 'Concurrency', placeholder: 'blank = unlimited, 0 = disabled', hint: 'Max concurrent auto-requests', badge: 'optional' },
        ],
      },
    ],
  },
  {
    title: 'Plex',
    icon: '📺',
    description: 'Optional — for Date Night collection sync',
    rows: [
      {
        fields: [
          { key: 'plex_url', label: 'Server URL', placeholder: 'http://plex:32400' },
          { key: 'plex_token', label: 'Token', sensitive: true },
        ],
      },
    ],
  },
  {
    title: 'Anthropic',
    icon: '🤖',
    description: 'Optional — for Recommendations feature',
    rows: [
      {
        fields: [
          {
            key: 'anthropic_api_key',
            label: 'API Key',
            sensitive: true,
            placeholder: 'sk-ant-…',
            hint: 'Get a key at',
            hintUrl: 'https://console.anthropic.com/',
            hintLinkText: 'console.anthropic.com',
            hintSuffix: '— leave blank to disable recommendations.',
          },
        ],
      },
    ],
  },
]

interface SettingsFormProps {
  initialValues: Record<string, string>
  redirectTo?: string
  submitLabel?: string
}

export function SettingsForm({
  initialValues,
  redirectTo,
  submitLabel = 'Save Settings',
}: SettingsFormProps) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function toggleReveal(key: string) {
    setRevealed((r) => ({ ...r, [key]: !r[key] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSaving(false)
    if (redirectTo) router.push(redirectTo)
  }

  return (
    <form onSubmit={handleSubmit}>
      {SECTIONS.map((section) => (
        <div
          key={section.title}
          className="bg-white rounded-xl border border-amber-200 mb-5 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-200">
            <span className="text-base">{section.icon}</span>
            <span className="font-semibold text-sm text-amber-900">{section.title}</span>
            {section.description && (
              <span className="ml-auto text-xs text-amber-600">{section.description}</span>
            )}
          </div>
          <div className="px-5 py-5 flex flex-col gap-4">
            {section.rows.map((row, rowIdx) => (
              <div
                key={rowIdx}
                className={row.fields.length === 2 ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-1'}
              >
                {row.fields.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={field.key}
                        className="text-xs font-semibold text-amber-900 uppercase tracking-wide"
                      >
                        {field.label}
                      </label>
                      {field.badge === 'required' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          required
                        </span>
                      )}
                      {field.badge === 'optional' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          optional
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id={field.key}
                        type={field.sensitive && !revealed[field.key] ? 'password' : 'text'}
                        value={values[field.key] ?? ''}
                        onChange={(e) => set(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className={`bg-amber-50 border-amber-200 focus:border-amber-500 ${
                          field.sensitive ? 'pr-9' : ''
                        }`}
                      />
                      {field.sensitive && (
                        <button
                          type="button"
                          onClick={() => toggleReveal(field.key)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-amber-500 hover:text-amber-700 text-sm"
                          title={revealed[field.key] ? 'Hide' : 'Reveal'}
                        >
                          {revealed[field.key] ? '🙈' : '👁'}
                        </button>
                      )}
                    </div>
                    {(field.hint || field.hintUrl) && (
                      <p className="text-xs text-amber-600">
                        {field.hint}{field.hint && field.hintUrl ? ' ' : ''}
                        {field.hintUrl && (
                          <a
                            href={field.hintUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-amber-700 hover:underline"
                          >
                            {field.hintLinkText ?? field.hintUrl} ↗
                          </a>
                        )}
                        {field.hintSuffix ? ` ${field.hintSuffix}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between pt-2 pb-6">
        <p className="text-sm text-amber-600">
          Changes are saved to the database and take effect immediately.
        </p>
        <Button
          type="submit"
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
