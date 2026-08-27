// src/components/settings-form.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Clapperboard, Download, Tv, Bot, Play, Eye, EyeOff, type LucideIcon } from 'lucide-react'
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
  icon: LucideIcon
  description?: string
  rows: Row[]
}

const SECTIONS: Section[] = [
  {
    title: 'General',
    icon: Users,
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
    icon: Clapperboard,
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
    icon: Download,
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
    icon: Tv,
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
    icon: Bot,
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
  // tracks which region the current providers list was fetched for;
  // differs from `region` while a fetch is in flight → derived loading state
  const [loadedRegion, setLoadedRegion] = useState<string | null>(null)

  const region = values['streaming_region'] || 'US'
  const loadingProviders = loadedRegion !== region
  useEffect(() => {
    fetch(`/api/streaming-providers?region=${encodeURIComponent(region)}`)
      .then((r) => r.json())
      .then((data) => { setProviders(data); setLoadedRegion(region) })
      .catch(() => { setProviders([]); setLoadedRegion(region) })
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
          className="bg-card rounded-xl border border-border mb-5 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-5 py-3 bg-muted border-b border-border">
            <section.icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-semibold text-sm text-foreground">{section.title}</span>
            {section.description && (
              <span className="ml-auto text-xs text-muted-foreground">{section.description}</span>
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
                        className="text-xs font-semibold text-foreground uppercase tracking-wide"
                      >
                        {field.label}
                      </label>
                      {field.badge === 'required' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-downloading-bg text-primary border border-border">
                          required
                        </span>
                      )}
                      {field.badge === 'optional' && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
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
                        className={field.sensitive ? 'pr-9' : ''}
                      />
                      {field.sensitive && (
                        <button
                          type="button"
                          onClick={() => toggleReveal(field.key)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                          title={revealed[field.key] ? 'Hide' : 'Reveal'}
                        >
                          {revealed[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                    {(field.hint || field.hintUrl) && (
                      <p className="text-xs text-muted-foreground">
                        {field.hint}{field.hint && field.hintUrl ? ' ' : ''}
                        {field.hintUrl && (
                          <a
                            href={field.hintUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline"
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
      <div className="bg-card rounded-xl border border-border mb-5 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-muted border-b border-border">
          <Play className="w-4 h-4 text-muted-foreground" fill="currentColor" aria-hidden="true" />
          <span className="font-semibold text-sm text-foreground">Streaming</span>
          <span className="ml-auto text-xs text-muted-foreground">Optional — for streaming availability</span>
        </div>
        <div className="px-5 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="streaming_region"
              className="text-xs font-semibold text-foreground uppercase tracking-wide"
            >
              Region
            </label>
            <select
              id="streaming_region"
              value={values['streaming_region'] ?? 'US'}
              onChange={(e) => set('streaming_region', e.target.value)}
              className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
            <p className="text-xs text-muted-foreground">
              Determines which streaming services are shown.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Your Streaming Services
            </span>
            {loadingProviders ? (
              <p className="text-xs text-muted-foreground">Loading providers…</p>
            ) : providers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
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
                          ? 'border-transparent bg-primary text-primary-foreground'
                          : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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
            <p className="text-xs text-muted-foreground">
              Select the services you subscribe to. Movies available on these services will show Watch buttons.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 pb-6">
        <p className="text-sm text-muted-foreground">
          Changes are saved to the database and take effect immediately.
        </p>
        <Button
          type="submit"
          disabled={saving}
        >
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
