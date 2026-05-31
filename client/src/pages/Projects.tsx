import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconPlus,
  IconFile3d,
  IconCircleCheck,
  IconAlertTriangle,
  IconX,
  IconTrash,
  IconExternalLink,
  IconRobot,
  IconRefresh,
  IconCheck,
  IconReceipt,
  IconBrandAmazon,
} from '@tabler/icons-react'
import AppShell from '../components/AppShell'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────

interface SavedProject {
  id: string
  source_platform: string
  source_url: string
  project_title: string | null
  designer_name: string | null
  status: string
  notes: string | null
  parsed_at: string | null
  created_at: string
}

interface ProjectComponent {
  component: {
    id: string
    project_id: string
    component_name: string
    component_type: string | null
    bambu_sku: string | null
    qty_required: string | null
    inventory_item_id: string | null
    inventory_item_type: string | null
    inventory_status: string | null
    affiliate_amazon_url: string | null
    affiliate_bambu_url: string | null
    affiliate_ali_url: string | null
    user_confirmed: boolean | null
    notes: string | null
  }
  workshop_name: string | null
  workshop_qty: string | null
  filament_brand: string | null
  filament_material: string | null
}

interface ProjectDetail {
  project: SavedProject
  components: ProjectComponent[]
  readiness: { ready: number; total: number }
}

interface ParseResult {
  project: SavedProject
  components: Array<Record<string, unknown>>
  components_found: number
}

// License info stored in project.notes as JSON
interface LicenseInfo {
  license: string
  commercial_ok: boolean | null
}

// ── Hooks ─────────────────────────────────────────────────────

const PROJECTS_KEY = ['projects'] as const

function useProjects() {
  return useQuery({ queryKey: PROJECTS_KEY, queryFn: () => api.get<SavedProject[]>('/projects') })
}

function useProjectDetail(id: string) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
  })
}

function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/projects', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  })
}

function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/projects/${id}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: PROJECTS_KEY })
      qc.invalidateQueries({ queryKey: ['project', v.id] })
    },
  })
}

function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  })
}

function useParseProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<ParseResult>(`/projects/${id}/parse`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROJECTS_KEY })
      qc.invalidateQueries({ queryKey: ['project', id] })
    },
  })
}

function useConfirmComponent(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cid: string) =>
      api.patch(`/projects/${projectId}/components/${cid}/confirm`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  })
}

function useCreateQuoteFromProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) =>
      api.post<{ id: string }>(`/quotes/from-project/${projectId}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })
}

// ── License helpers ───────────────────────────────────────────

function parseLicense(notes: string | null): LicenseInfo | null {
  if (!notes) return null
  try {
    const obj = JSON.parse(notes)
    if (typeof obj.license === 'string') return obj as LicenseInfo
  } catch {}
  return null
}

function LicenseBadge({ project }: { project: SavedProject }) {
  const info = parseLicense(project.notes)
  if (!info) {
    if (project.source_platform !== 'makerworld') return null
    return (
      <Badge variant="default" title="License not detected">License unknown</Badge>
    )
  }
  if (info.commercial_ok === true) {
    return <Badge variant="success" icon={IconCircleCheck}>Commercial OK</Badge>
  }
  if (info.commercial_ok === false) {
    return (
      <Badge variant="warning" icon={IconAlertTriangle} title={info.license}>
        Personal use only
      </Badge>
    )
  }
  return <Badge variant="default">{info.license}</Badge>
}

// ── Platform badge ────────────────────────────────────────────

function platformBadge(platform: string) {
  switch (platform) {
    case 'makerworld':  return <Badge variant="accent">MakerWorld</Badge>
    case 'printables':  return <Badge variant="info">Printables</Badge>
    case 'thingiverse': return <Badge variant="default">Thingiverse</Badge>
    case 'cults3d':     return <Badge variant="default">Cults3D</Badge>
    default:            return <Badge>{platform}</Badge>
  }
}

const STATUSES = [
  { value: 'want_to_print', label: 'Want to print' },
  { value: 'printing',      label: 'Printing' },
  { value: 'completed',     label: 'Completed' },
]

// ── Inventory status icon ─────────────────────────────────────

function inventoryIcon(status: string | null) {
  switch (status) {
    case 'have_it': return <IconCircleCheck size={14} className="text-success shrink-0" />
    case 'low':     return <IconAlertTriangle size={14} className="text-warning shrink-0" />
    case 'missing': return <IconX size={14} className="text-danger shrink-0" />
    default:        return <span className="w-3.5 h-3.5 rounded-full bg-elevated inline-block shrink-0" />
  }
}

// ── Readiness progress bar ────────────────────────────────────

function ReadinessBar({ ready, total }: { ready: number; total: number }) {
  if (total === 0) return null
  const pct = Math.round((ready / total) * 100)
  const color = pct === 100 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-danger'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-ink-secondary shrink-0">{ready}/{total}</span>
    </div>
  )
}

// ── Component row ─────────────────────────────────────────────

function ComponentRow({
  row,
  projectId,
  onAddToInventory,
}: {
  row: ProjectComponent
  projectId: string
  onAddToInventory: (name: string, notes: string | null) => void
}) {
  const c = row.component
  const confirm = useConfirmComponent(projectId)
  const isMissing = c.inventory_status === 'missing'
  const isLow     = c.inventory_status === 'low'
  const showBuy   = isMissing || isLow

  return (
    <div className="py-2.5 border-b border-border last:border-0">
      <div className="flex items-start gap-2">
        {inventoryIcon(c.inventory_status)}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-ink-primary">{c.component_name}</span>
            {c.component_type && (
              <span className="text-[10px] uppercase font-semibold text-ink-tertiary">{c.component_type}</span>
            )}
            {c.bambu_sku && (
              <Badge variant="accent" className="text-[9px]">{c.bambu_sku}</Badge>
            )}
            {c.user_confirmed && (
              <span title="Confirmed" className="text-success">
                <IconCheck size={11} />
              </span>
            )}
          </div>

          {c.notes && (
            <p className="text-[11px] text-ink-tertiary mt-0.5">{c.notes}</p>
          )}

          {/* Buy links */}
          {showBuy && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {c.affiliate_amazon_url && (
                <a
                  href={c.affiliate_amazon_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-elevated border border-border hover:border-border-strong text-ink-secondary hover:text-ink-primary transition-colors"
                >
                  <IconBrandAmazon size={10} /> Amazon
                </a>
              )}
              {c.affiliate_bambu_url && c.bambu_sku && (
                <a
                  href={c.affiliate_bambu_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-elevated border border-border hover:border-border-strong text-accent hover:text-accent transition-colors"
                >
                  Bambu ↗
                </a>
              )}
              {c.affiliate_ali_url && (
                <a
                  href={c.affiliate_ali_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-elevated border border-border hover:border-border-strong text-ink-secondary hover:text-ink-primary transition-colors"
                >
                  AliExpress ↗
                </a>
              )}
              <button
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-elevated border border-border hover:bg-accent-subtle hover:border-accent text-ink-secondary hover:text-accent transition-colors"
                onClick={() => onAddToInventory(c.component_name, c.notes)}
              >
                <IconPlus size={9} /> Add to inventory
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {c.qty_required && (
            <span className="text-xs font-mono text-ink-tertiary">×{c.qty_required}</span>
          )}
          <span className={[
            'text-[10px] font-semibold capitalize',
            c.inventory_status === 'have_it' ? 'text-success' :
            c.inventory_status === 'low' ? 'text-warning' :
            c.inventory_status === 'missing' ? 'text-danger' : 'text-ink-tertiary',
          ].join(' ')}>
            {c.inventory_status === 'have_it' ? 'In stock'
              : c.inventory_status === 'low' ? 'Low stock'
              : c.inventory_status === 'missing' ? 'Need to buy'
              : 'Not tracked'}
          </span>

          {!c.user_confirmed && (
            <button
              className="btn-icon w-5 h-5 hover:text-success"
              title="Confirm this component"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate(c.id)}
            >
              <IconCheck size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add-to-inventory modal ────────────────────────────────────

function AddToInventoryModal({
  name,
  notes,
  onClose,
}: {
  name: string
  notes: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name,
    category: 'hardware',
    unit: 'pcs',
    quantity: '1',
    notes: notes ?? '',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/workshop', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workshop'] })
      onClose()
    },
  })

  return (
    <Modal title="Add to Workshop Inventory" onClose={onClose} width="max-w-md">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          await create.mutateAsync({
            name: form.name,
            category: form.category,
            unit: form.unit,
            quantity: parseFloat(form.quantity) || 0,
            notes: form.notes || undefined,
          })
        }}
        className="space-y-4"
      >
        <div>
          <label className="label">Item name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {['hardware','fastener','electronic','tool_durable','tool_consumable','other'].map((c) => (
                <option key={c} value={c}>{c.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Unit</label>
            <input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="pcs" />
          </div>
          <div>
            <label className="label">Qty</label>
            <input className="input font-mono" type="number" min="0" step="1"
              value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Notes <span className="text-ink-tertiary">(optional)</span></label>
          <input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">
            {create.isPending ? 'Adding…' : 'Add to workshop'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Commercial license warning ────────────────────────────────

function LicenseWarningStrip({ project }: { project: SavedProject }) {
  const info = parseLicense(project.notes)
  if (!info || info.commercial_ok !== false) return null
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-md bg-warning-bg border border-border text-xs text-warning mb-3">
      <IconAlertTriangle size={13} className="shrink-0 mt-0.5" />
      <span>
        <strong>{info.license}</strong> — This design may not allow commercial sales.
        Verify the license on {project.source_platform === 'makerworld' ? 'MakerWorld' : 'the project page'} before selling prints.
      </span>
    </div>
  )
}

// ── Project card ──────────────────────────────────────────────

function ProjectCard({ project }: { project: SavedProject }) {
  const [expanded, setExpanded]         = useState(false)
  const [addInventory, setAddInventory] = useState<{ name: string; notes: string | null } | null>(null)

  const { data: detail, isLoading } = useProjectDetail(expanded ? project.id : '')
  const updateProject  = useUpdateProject()
  const deleteProject  = useDeleteProject()
  const parseProject   = useParseProject(project.id)
  const createQuote    = useCreateQuoteFromProject()
  const navigate       = useNavigate()
  const qc             = useQueryClient()

  const hasBeenParsed = !!project.parsed_at
  const readiness     = detail?.readiness

  async function handleCreateQuote() {
    const quote = await createQuote.mutateAsync(project.id)
    navigate(`/quotes?open=${quote.id}`)
  }

  async function handleConfirmAll() {
    if (!detail) return
    for (const row of detail.components) {
      if (!row.component.user_confirmed) {
        await api.patch(`/projects/${project.id}/components/${row.component.id}/confirm`, {})
      }
    }
    qc.invalidateQueries({ queryKey: ['project', project.id] })
  }

  return (
    <div className="card">
      {/* Card header */}
      <div
        className="flex items-start gap-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-7 h-7 rounded-md bg-elevated flex items-center justify-center shrink-0 mt-0.5">
          <IconFile3d size={15} className="text-accent" stroke={1.5} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {platformBadge(project.source_platform)}
            <LicenseBadge project={project} />
          </div>
          <p className="text-md font-semibold text-ink-primary mt-1">
            {project.project_title ?? project.source_url}
          </p>
          {project.designer_name && (
            <p className="text-xs text-ink-tertiary">by {project.designer_name}</p>
          )}
          {readiness && readiness.total > 0 && (
            <div className="mt-2 max-w-xs">
              <ReadinessBar ready={readiness.ready} total={readiness.total} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Parse / re-parse button */}
          <button
            className="btn-secondary text-xs py-1 px-2 gap-1"
            disabled={parseProject.isPending}
            onClick={() => parseProject.mutate()}
            title={hasBeenParsed ? 'Re-analyze with AI' : 'Analyze with AI'}
          >
            {parseProject.isPending
              ? <><IconRobot size={12} className="animate-pulse" /> Analyzing…</>
              : hasBeenParsed
              ? <><IconRefresh size={12} /> Re-parse</>
              : <><IconRobot size={12} /> Parse project</>}
          </button>

          <a
            href={project.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-icon"
            title="Open project"
          >
            <IconExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Parse result notification */}
      {parseProject.isSuccess && (
        <div className="mt-2 px-2 py-1.5 rounded-md bg-success-bg border border-border text-xs text-success">
          <IconCircleCheck size={11} className="inline mr-1" />
          Found {(parseProject.data as ParseResult).components_found} components.
        </div>
      )}

      {parseProject.isError && (
        <div className="mt-2 px-2 py-1.5 rounded-md bg-danger-bg border border-border text-xs text-danger">
          {(parseProject.error as Error).message}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border">
          {isLoading && <p className="text-xs text-ink-tertiary">Loading…</p>}

          {detail && (
            <>
              {/* Commercial license warning for quotes */}
              <LicenseWarningStrip project={detail.project} />

              {/* Component list */}
              {detail.components.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase text-ink-tertiary tracking-wider">
                      {detail.components.length} components
                    </p>
                    <button
                      className="text-[10px] text-accent hover:underline"
                      onClick={handleConfirmAll}
                    >
                      Confirm all
                    </button>
                  </div>
                  {detail.components.map((row) => (
                    <ComponentRow
                      key={row.component.id}
                      row={row}
                      projectId={project.id}
                      onAddToInventory={(name, notes) => setAddInventory({ name, notes })}
                    />
                  ))}
                </>
              ) : (
                <p className="text-xs text-ink-tertiary mb-3">
                  No components yet. Click <strong>Parse project</strong> to analyze with AI.
                </p>
              )}

              {/* Action bar */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                <select
                  className="input text-xs py-1 h-auto"
                  style={{ width: 'auto' }}
                  value={project.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation()
                    updateProject.mutate({ id: project.id, data: { status: e.target.value } })
                  }}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                <button
                  className="btn-secondary text-xs py-1 px-2 gap-1"
                  disabled={createQuote.isPending}
                  onClick={handleCreateQuote}
                  title="Create a pricing quote from this project"
                >
                  <IconReceipt size={12} /> Create quote
                </button>

                <button
                  className="btn-icon ml-auto text-danger hover:bg-danger-bg"
                  title="Delete project"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Delete "${project.project_title ?? project.source_url}"?`)) {
                      deleteProject.mutate(project.id)
                    }
                  }}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {addInventory && (
        <AddToInventoryModal
          name={addInventory.name}
          notes={addInventory.notes}
          onClose={() => setAddInventory(null)}
        />
      )}
    </div>
  )
}

// ── Add project modal ─────────────────────────────────────────

const PLATFORMS = [
  { value: 'makerworld',  label: 'MakerWorld' },
  { value: 'printables',  label: 'Printables' },
  { value: 'thingiverse', label: 'Thingiverse' },
  { value: 'cults3d',     label: 'Cults3D' },
  { value: 'other',       label: 'Other' },
]

function AddProjectModal({ onClose }: { onClose: () => void }) {
  const create = useCreateProject()
  const [form, setForm] = useState({
    source_url: '',
    project_title: '',
    designer_name: '',
    source_platform: 'makerworld',
    status: 'want_to_print',
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Auto-detect platform from URL
  function handleUrlChange(url: string) {
    set('source_url', url)
    try {
      const host = new URL(url).hostname
      if (host.includes('makerworld.com'))  set('source_platform', 'makerworld')
      else if (host.includes('printables.com')) set('source_platform', 'printables')
      else if (host.includes('thingiverse.com')) set('source_platform', 'thingiverse')
      else if (host.includes('cults3d.com')) set('source_platform', 'cults3d')
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await create.mutateAsync({
      source_url: form.source_url,
      project_title: form.project_title || undefined,
      designer_name: form.designer_name || undefined,
      source_platform: form.source_platform,
      status: form.status,
    })
    onClose()
  }

  return (
    <Modal title="Save Project" onClose={onClose} width="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Project URL</label>
          <input className="input" value={form.source_url} onChange={(e) => handleUrlChange(e.target.value)}
            required placeholder="https://makerworld.com/models/…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Platform</label>
            <select className="input" value={form.source_platform} onChange={(e) => set('source_platform', e.target.value)}>
              {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Title <span className="text-ink-tertiary">(optional — auto-filled by parser)</span></label>
          <input className="input" value={form.project_title} onChange={(e) => set('project_title', e.target.value)}
            placeholder="e.g. Gridfinity Base Plate" />
        </div>
        <div>
          <label className="label">Designer <span className="text-ink-tertiary">(optional)</span></label>
          <input className="input" value={form.designer_name} onChange={(e) => set('designer_name', e.target.value)}
            placeholder="e.g. Zack Freedman" />
        </div>
        {create.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(create.error as Error).message}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={create.isPending} className="btn-primary flex-1 justify-center">
            {create.isPending ? 'Saving…' : 'Save project'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Affiliate disclosure ───────────────────────────────────────

function AffiliateDisclosure() {
  return (
    <p className="text-[10px] text-ink-tertiary mt-4 text-center">
      FilamentOS may earn a small commission if you purchase through these links, at no extra cost to you.
    </p>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects()
  const [showAdd, setShowAdd] = useState(false)

  const wantToPrint = projects.filter((p) => p.status === 'want_to_print').length
  const printing    = projects.filter((p) => p.status === 'printing').length
  const completed   = projects.filter((p) => p.status === 'completed').length
  const hasBuyLinks = projects.some((p) => !!p.parsed_at)

  return (
    <AppShell title="Projects">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-ink-primary">Saved Projects</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            {wantToPrint} queued · {printing} printing · {completed} completed
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <IconPlus size={15} /> Save project
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card animate-pulse h-16 bg-elevated" />
          ))}
        </div>
      )}

      {!isLoading && projects.length === 0 && (
        <div className="card text-center py-12">
          <IconFile3d size={32} className="text-ink-tertiary mx-auto mb-3" stroke={1} />
          <p className="text-ink-secondary text-md font-medium">No projects saved yet</p>
          <p className="text-ink-tertiary text-xs mt-1">
            Save a MakerWorld or Printables URL, then click <strong>Parse project</strong> to extract components with AI.
          </p>
        </div>
      )}

      {!isLoading && projects.length > 0 && (
        <div className="space-y-2">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {hasBuyLinks && <AffiliateDisclosure />}

      {showAdd && <AddProjectModal onClose={() => setShowAdd(false)} />}
    </AppShell>
  )
}
