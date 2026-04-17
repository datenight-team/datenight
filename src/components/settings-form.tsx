// src/components/settings-form.tsx
'use client'
import { useState, useEffect } from 'react'
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

interface StreamingProviderOption {
  providerId: number
  providerName: string
  logoPath: string
}

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
  const [providers, setProviders] = useState<StreamingProviderOption[]>([])
  const [loadingProviders, setLoadingProviders] = useState(false)

  const region = values['streaming_region'] || 'US'
  useEffect(() => {
    setLoadingProviders(true)
    fetch('/api/streaming-providers')
      .then((r) => r.json())
      .then((data) => setProviders(data))
      .catch(() => {})
      .finally(() => setLoadingProviders(false))
  }, [region])

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function toggleReveal(key: string) {
    setRevealed((r) => ({ ...r, [key]: !r[key] }))
  }

  function getSelectedProviderIds(): number[] {
    try {
      return JSON.parse(values['streaming_services'] || '[]')
    } catch {
      return []
    }
  }

  function toggleProvider(providerId: number) {
    const current = getSelectedProviderIds()
    const updated = current.includes(providerId)
      ? current.filter((id) => id !== providerId)
      : [...current, providerId]
    set('streaming_services', JSON.stringify(updated))
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

      {/* Streaming section — custom layout (provider checkboxes don't fit the text-field pattern) */}
      <div className="bg-white rounded-xl border border-amber-200 mb-5 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-200">
          <span className="text-base">▶️</span>
          <span className="font-semibold text-sm text-amber-900">Streaming</span>
          <span className="ml-auto text-xs text-amber-600">Optional — for streaming availability</span>
        </div>
        <div className="px-5 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="streaming_region"
              className="text-xs font-semibold text-amber-900 uppercase tracking-wide"
            >
              Region
            </label>
            <select
              id="streaming_region"
              value={values['streaming_region'] ?? 'US'}
              onChange={(e) => set('streaming_region', e.target.value)}
              className="w-64 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="AR">Argentina</option>
              <option value="AU">Australia</option>
              <option value="AT">Austria</option>
              <option value="BE">Belgium</option>
              <option value="BR">Brazil</option>
              <option value="CA">Canada</option>
              <option value="CL">Chile</option>
              <option value="CO">Colombia</option>
              <option value="DK">Denmark</option>
              <option value="FI">Finland</option>
              <option value="FR">France</option>
              <option value="DE">Germany</option>
              <option value="IN">India</option>
              <option value="IE">Ireland</option>
              <option value="IT">Italy</option>
              <option value="JP">Japan</option>
              <option value="KR">South Korea</option>
              <option value="MX">Mexico</option>
              <option value="NL">Netherlands</option>
              <option value="NZ">New Zealand</option>
              <option value="NO">Norway</option>
              <option value="PL">Poland</option>
              <option value="PT">Portugal</option>
              <option value="ZA">South Africa</option>
              <option value="ES">Spain</option>
              <option value="SE">Sweden</option>
              <option value="CH">Switzerland</option>
              <option value="GB">United Kingdom</option>
              <option value="US">United States</option>
            </select>
            <p className="text-xs text-amber-600">
              Determines which streaming services are shown.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
              Your Streaming Services
            </span>
            {loadingProviders ? (
              <p className="text-xs text-amber-600">Loading providers…</p>
            ) : providers.length === 0 ? (
              <p className="text-xs text-amber-600">
                No providers found. Check your TMDB API key and region above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {providers.map((p) => {
                  const selected = getSelectedProviderIds().includes(p.providerId)
                  return (
                    <button
                      key={p.providerId}
                      type="button"
                      onClick={() => toggleProvider(p.providerId)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
                      }`}
                    >
                      <img
                        src={`/streaming-logos/${p.providerId}.png`}
                        alt=""
                        width={16}
                        height={16}
                        className="rounded-sm object-contain"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      {p.providerName}
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-amber-600">
              Select the services you subscribe to. Movies available on these services will show Watch buttons.
            </p>
          </div>
        </div>
      </div>

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
