import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconUser,
  IconBolt,
  IconReceipt,
  IconDownload,
} from '@tabler/icons-react'
import AppShell from '../components/AppShell'
import { useAuthStore } from '../stores/auth'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────

interface QuoteSettings {
  electricity_rate_per_kwh: string
  default_printer_wattage_w: number
  labor_rate_per_hr: string
  include_electricity: boolean
  include_labor: boolean
  include_wear_costs: boolean
  default_markup: string
  default_venue: string
  default_packaging_cost: string
}

// ── Hooks ─────────────────────────────────────────────────────

function useQuoteSettings() {
  return useQuery({
    queryKey: ['quote-settings'],
    queryFn: () => api.get<QuoteSettings>('/quotes/settings'),
  })
}

function useUpdateQuoteSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch('/quotes/settings', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote-settings'] }),
  })
}

// ── Section heading ───────────────────────────────────────────

function SectionHeading({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-md bg-elevated flex items-center justify-center">
        <Icon size={14} className="text-accent" stroke={1.75} />
      </div>
      <h2 className="text-md font-semibold text-ink-primary">{title}</h2>
    </div>
  )
}

// ── Profile section ───────────────────────────────────────────

function ProfileSection() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="card mb-4">
      <SectionHeading icon={IconUser} title="Profile" />
      <div className="space-y-3">
        <div>
          <p className="label">Email</p>
          <p className="text-sm text-ink-secondary">{user?.email}</p>
        </div>
        <div>
          <p className="label">Experience level</p>
          <p className="text-sm text-ink-secondary capitalize">{user?.experience_level ?? 'beginner'}</p>
        </div>
        <div>
          <p className="label">Mode</p>
          <p className="text-sm text-ink-secondary capitalize">{user?.mode ?? 'maker'}</p>
        </div>
      </div>
    </div>
  )
}

// ── Quote settings section ────────────────────────────────────

const VENUES = [
  { value: 'farmers_market', label: 'Farmers market' },
  { value: 'etsy',           label: 'Etsy' },
  { value: 'local',          label: 'Local sale' },
  { value: 'convention',     label: 'Convention' },
  { value: 'other',          label: 'Other' },
]

function QuoteSettingsSection() {
  const { data: settings, isLoading } = useQuoteSettings()
  const update = useUpdateQuoteSettings()
  const [form, setForm] = useState<Record<string, string | boolean>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        electricity_rate_per_kwh:  settings.electricity_rate_per_kwh,
        default_printer_wattage_w: settings.default_printer_wattage_w.toString(),
        labor_rate_per_hr:         settings.labor_rate_per_hr,
        include_electricity:       settings.include_electricity,
        include_labor:             settings.include_labor,
        include_wear_costs:        settings.include_wear_costs,
        default_markup:            settings.default_markup,
        default_venue:             settings.default_venue,
        default_packaging_cost:    settings.default_packaging_cost,
      })
    }
  }, [settings])

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await update.mutateAsync({
      electricity_rate_per_kwh:  parseFloat(form.electricity_rate_per_kwh as string),
      default_printer_wattage_w: parseInt(form.default_printer_wattage_w as string),
      labor_rate_per_hr:         parseFloat(form.labor_rate_per_hr as string),
      include_electricity:       form.include_electricity,
      include_labor:             form.include_labor,
      include_wear_costs:        form.include_wear_costs,
      default_markup:            parseFloat(form.default_markup as string),
      default_venue:             form.default_venue,
      default_packaging_cost:    parseFloat(form.default_packaging_cost as string),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="card mb-4">
        <SectionHeading icon={IconReceipt} title="Quote settings" />
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((n) => <div key={n} className="h-8 bg-elevated rounded-md" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="card mb-4">
      <SectionHeading icon={IconReceipt} title="Quote settings" />
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Electricity rate ($/kWh)</label>
            <input className="input font-mono" type="number" step="0.001" min="0"
              value={form.electricity_rate_per_kwh as string ?? ''}
              onChange={(e) => set('electricity_rate_per_kwh', e.target.value)}
              placeholder="0.14" />
          </div>
          <div>
            <label className="label">Printer wattage (W)</label>
            <input className="input font-mono" type="number" step="1" min="0"
              value={form.default_printer_wattage_w as string ?? ''}
              onChange={(e) => set('default_printer_wattage_w', e.target.value)}
              placeholder="200" />
          </div>
          <div>
            <label className="label">Labor rate ($/hr)</label>
            <input className="input font-mono" type="number" step="0.01" min="0"
              value={form.labor_rate_per_hr as string ?? ''}
              onChange={(e) => set('labor_rate_per_hr', e.target.value)}
              placeholder="15.00" />
          </div>
          <div>
            <label className="label">Default markup multiplier</label>
            <input className="input font-mono" type="number" step="0.1" min="1"
              value={form.default_markup as string ?? ''}
              onChange={(e) => set('default_markup', e.target.value)}
              placeholder="3.0" />
          </div>
          <div>
            <label className="label">Default packaging cost ($)</label>
            <input className="input font-mono" type="number" step="0.01" min="0"
              value={form.default_packaging_cost as string ?? ''}
              onChange={(e) => set('default_packaging_cost', e.target.value)}
              placeholder="0.00" />
          </div>
          <div>
            <label className="label">Default venue</label>
            <select className="input" value={form.default_venue as string ?? 'other'}
              onChange={(e) => set('default_venue', e.target.value)}>
              {VENUES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {[
            { key: 'include_electricity', label: 'Include electricity in quotes' },
            { key: 'include_labor',       label: 'Include labor in quotes' },
            { key: 'include_wear_costs',  label: 'Include nozzle/plate wear in quotes' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form[key] as boolean ?? true}
                onChange={(e) => set(key, e.target.checked)}
                className="accent-accent"
              />
              <span className="text-sm text-ink-secondary">{label}</span>
            </label>
          ))}
        </div>

        <button type="submit" disabled={update.isPending} className="btn-primary">
          {saved ? <><IconBolt size={13} /> Saved!</> : update.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  )
}

// ── PWA install section ───────────────────────────────────────

function PWASection() {
  const [canInstall, setCanInstall] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    const prompt = deferredPrompt as BeforeInstallPromptEvent
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setCanInstall(false)
  }

  if (!canInstall) return null

  return (
    <div className="card mb-4">
      <SectionHeading icon={IconDownload} title="Install app" />
      <p className="text-sm text-ink-secondary mb-3">
        Install FilamentOS on your home screen for quick access at the printer.
      </p>
      <button className="btn-primary" onClick={handleInstall}>
        <IconDownload size={14} /> Install FilamentOS
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <div className="max-w-2xl">
        <h1 className="text-lg font-bold text-ink-primary mb-5">Settings</h1>
        <PWASection />
        <ProfileSection />
        <QuoteSettingsSection />
      </div>
    </AppShell>
  )
}

// PWA type augmentation
declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): void
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
}
