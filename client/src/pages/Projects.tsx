import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  IconPlus,
  IconFile3d,
  IconCircleCheck,
  IconAlertTriangle,
  IconX,
  IconTrash,
  IconExternalLink,
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
  created_at: string
}

interface ProjectComponent {
  component: {
    id: string
    project_id: string
    component_name: string
    component_type: string | null
    qty_required: string | null
    inventory_item_id: string | null
    inventory_item_type: string | null
    inventory_status: string | null
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
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  })
}

function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: PROJECTS_KEY }),
  })
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

// ── Status selector ───────────────────────────────────────────

const STATUSES = [
  { value: 'want_to_print', label: 'Want to print' },
  { value: 'printing',      label: 'Printing' },
  { value: 'completed',     label: 'Completed' },
]

function statusBadge(status: string) {
  switch (status) {
    case 'want_to_print': return <Badge variant="default">Want to print</Badge>
    case 'printing':      return <Badge variant="accent">Printing</Badge>
    case 'completed':     return <Badge variant="success">Completed</Badge>
    default:              return <Badge>{status}</Badge>
  }
}

// ── Inventory status icon ─────────────────────────────────────

function inventoryIcon(status: string | null) {
  switch (status) {
    case 'have_it': return <IconCircleCheck size={14} className="text-success" />
    case 'low':     return <IconAlertTriangle size={14} className="text-warning" />
    case 'missing': return <IconX size={14} className="text-danger" />
    default:        return <span className="w-3.5 h-3.5 rounded-full bg-elevated inline-block" />
  }
}

// ── Project card ──────────────────────────────────────────────

function ProjectCard({ project }: { project: SavedProject }) {
  const [expanded, setExpanded] = useState(false)
  const { data: detail, isLoading } = useProjectDetail(expanded ? project.id : '')
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  return (
    <div className="card">
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
            {statusBadge(project.status)}
          </div>
          <p className="text-md font-semibold text-ink-primary mt-1">
            {project.project_title ?? project.source_url}
          </p>
          {project.designer_name && (
            <p className="text-xs text-ink-tertiary">by {project.designer_name}</p>
          )}
        </div>

        <a
          href={project.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="btn-icon shrink-0"
          title="Open project"
        >
          <IconExternalLink size={14} />
        </a>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border">
          {isLoading && <p className="text-xs text-ink-tertiary">Loading…</p>}

          {detail && (
            <>
              {/* Readiness score */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-ink-secondary">Readiness:</span>
                <span className="font-mono text-sm text-ink-primary">
                  {detail.readiness.ready}/{detail.readiness.total} components ready
                </span>
              </div>

              {/* Component list */}
              {detail.components.length > 0 ? (
                <div className="space-y-0">
                  {detail.components.map((row) => (
                    <div
                      key={row.component.id}
                      className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                    >
                      <div className="w-4 shrink-0">
                        {inventoryIcon(row.component.inventory_status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink-primary">{row.component.component_name}</p>
                        {row.component.component_type && (
                          <p className="text-[10px] text-ink-tertiary uppercase font-semibold">{row.component.component_type}</p>
                        )}
                      </div>
                      {row.component.qty_required && (
                        <span className="text-xs font-mono text-ink-secondary shrink-0">
                          ×{row.component.qty_required}
                        </span>
                      )}
                      <span className="text-[10px] text-ink-tertiary capitalize shrink-0">
                        {row.component.inventory_status ?? 'untracked'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-tertiary mb-3">No components added. Add them manually below.</p>
              )}

              {/* Status change + delete */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                <select
                  className="input text-xs py-1 h-auto flex-1"
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
                  className="btn-icon text-danger hover:bg-danger-bg"
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
          <input className="input" value={form.source_url} onChange={(e) => set('source_url', e.target.value)}
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
          <label className="label">Title <span className="text-ink-tertiary">(optional)</span></label>
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

// ── Page ──────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects()
  const [showAdd, setShowAdd] = useState(false)

  const wantToPrint = projects.filter((p) => p.status === 'want_to_print').length
  const printing    = projects.filter((p) => p.status === 'printing').length
  const completed   = projects.filter((p) => p.status === 'completed').length

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
            Save MakerWorld, Printables, and Thingiverse projects to track inventory readiness.
          </p>
        </div>
      )}

      {!isLoading && projects.length > 0 && (
        <div className="space-y-2">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {showAdd && <AddProjectModal onClose={() => setShowAdd(false)} />}
    </AppShell>
  )
}
