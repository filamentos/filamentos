import { useState } from 'react'
import {
  IconPlus,
  IconPrinter,
  IconCircleCheck,
  IconTool,
  IconChevronRight,
} from '@tabler/icons-react'
import AppShell from '../components/AppShell'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import {
  usePrinters,
  usePrinterModels,
  useCreatePrinter,
  useAddAccessory,
  useAssignSlot,
  type PrinterDetail,
  type SlotInfo,
} from '../hooks/usePrinters'
import { useSpools } from '../hooks/useFilament'

// ── Status badge ──────────────────────────────────────────────

function statusBadge(status: string) {
  switch (status) {
    case 'active':      return <Badge variant="success">Active</Badge>
    case 'idle':        return <Badge variant="info">Idle</Badge>
    case 'maintenance': return <Badge variant="warning">Maintenance</Badge>
    case 'retired':     return <Badge variant="default">Retired</Badge>
    default:            return <Badge>{status}</Badge>
  }
}

// ── Slot grid ─────────────────────────────────────────────────

interface SlotCircleProps {
  slotInfo?: SlotInfo
  slotNumber: number
  onClick: () => void
}

function SlotCircle({ slotInfo, slotNumber, onClick }: SlotCircleProps) {
  const loaded = !!slotInfo?.slot.spool_id
  const hex    = slotInfo?.color_hex

  return (
    <button
      onClick={onClick}
      title={loaded
        ? `Slot ${slotNumber}: ${slotInfo?.brand} ${slotInfo?.material} (${slotInfo?.color_name ?? hex ?? 'Unknown'})`
        : `Slot ${slotNumber}: empty`}
      className="flex flex-col items-center gap-1 group"
    >
      <div
        className="w-6 h-6 rounded-full border-2 transition-all group-hover:scale-110"
        style={{
          backgroundColor: loaded && hex ? hex : 'transparent',
          borderColor: loaded ? '#2e3e58' : '#1e2a3e',
        }}
      />
      <span className="text-[9px] text-ink-tertiary font-mono">{slotNumber}</span>
    </button>
  )
}

// ── Printer card ──────────────────────────────────────────────

interface PrinterCardProps {
  printer: PrinterDetail
  onViewDetail: () => void
}

function PrinterCard({ printer, onViewDetail }: PrinterCardProps) {
  const totalSlots = printer.native_color_slots +
    (printer.accessories?.reduce((acc, a) => acc + (a.slots_added ?? 0), 0) ?? 0)

  const slotMap = new Map<number, SlotInfo>()
  for (const s of printer.slots ?? []) {
    slotMap.set(s.slot.slot_number, s)
  }

  return (
    <div
      className="card cursor-pointer hover:border-border-strong transition-colors"
      onClick={onViewDetail}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Printer info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-md bg-elevated flex items-center justify-center shrink-0">
            <IconPrinter size={18} className="text-ink-secondary" stroke={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-md font-semibold text-ink-primary truncate">
              {printer.nickname ?? `${printer.brand} ${printer.model}`}
            </p>
            <p className="text-xs text-ink-tertiary">
              {printer.brand} {printer.model}
              {printer.nickname ? '' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {statusBadge(printer.status)}
          <IconChevronRight size={14} className="text-ink-tertiary" />
        </div>
      </div>

      {/* Nozzle + build info */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <span className="text-xs text-ink-tertiary">
          <span className="text-ink-secondary font-medium">Nozzle</span>{' '}
          {printer.current_nozzle_diameter_mm}mm {printer.current_nozzle_material}
        </span>
        {printer.build_volume_x_mm && (
          <span className="text-xs text-ink-tertiary">
            <span className="text-ink-secondary font-medium">Build</span>{' '}
            {printer.build_volume_x_mm}×{printer.build_volume_y_mm}×{printer.build_volume_z_mm}mm
          </span>
        )}
        {printer.has_enclosure && (
          <span className="text-xs text-success">Enclosed</span>
        )}
      </div>

      {/* Slot grid */}
      {totalSlots > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] text-ink-tertiary uppercase font-semibold tracking-wide mb-2">
            {printer.multi_color_system ?? 'Slots'} — {totalSlots} total
          </p>
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: totalSlots }, (_, i) => i + 1).map((n) => (
              <SlotCircle
                key={n}
                slotNumber={n}
                slotInfo={slotMap.get(n)}
                onClick={onViewDetail}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add Printer modal ─────────────────────────────────────────

function AddPrinterModal({ onClose }: { onClose: () => void }) {
  const { data: models = [] } = usePrinterModels()
  const createPrinter = useCreatePrinter()

  const [query, setQuery]       = useState('')
  const [nickname, setNickname] = useState('')
  const [selected, setSelected] = useState<(typeof models)[0] | null>(null)
  const [showList, setShowList]  = useState(false)

  // Manual overrides
  const [nozzleTemp, setNozzleTemp]   = useState('')
  const [bedTemp, setBedTemp]         = useState('')
  const [enclosure, setEnclosure]     = useState<boolean | null>(null)
  const [nozzleMat, setNozzleMat]     = useState('brass')

  const filtered = models.filter((m) =>
    m.label.toLowerCase().includes(query.toLowerCase()),
  )

  function selectModel(m: typeof models[0]) {
    setSelected(m)
    setQuery(m.label)
    setShowList(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected && !query.trim()) return

    // If no known model selected, parse brand/model from the query string
    const brand = selected
      ? models.find((m) => m.label === query)?.brand ?? query.split(' ')[0]
      : query.split(' ')[0]
    const model = selected
      ? models.find((m) => m.label === query)?.model ?? query.split(' ').slice(1).join(' ')
      : query.split(' ').slice(1).join(' ') || query

    // Fetch auto-fill from server (the server has the full spec)
    const fullModel = models.find((m) => m.label === selected?.label)

    await createPrinter.mutateAsync({
      brand,
      model,
      nickname: nickname.trim() || undefined,
      max_nozzle_temp_c: nozzleTemp ? parseInt(nozzleTemp) : (fullModel ? undefined : undefined),
      max_bed_temp_c:    bedTemp    ? parseInt(bedTemp)    : undefined,
      has_enclosure:     enclosure  ?? undefined,
      current_nozzle_material: nozzleMat,
    })
    onClose()
  }

  return (
    <Modal title="Add Printer" onClose={onClose} width="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Model search */}
        <div className="relative">
          <label className="label">Brand & Model</label>
          <input
            className="input"
            placeholder="e.g. Bambu Lab X1 Carbon"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowList(true); setSelected(null) }}
            onFocus={() => setShowList(true)}
            autoFocus
            required
          />
          {showList && filtered.length > 0 && query && (
            <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-surface border border-border-strong rounded-lg shadow-xl max-h-52 overflow-y-auto">
              {filtered.map((m) => (
                <li key={m.label}>
                  <button
                    type="button"
                    onClick={() => selectModel(m)}
                    className="w-full text-left px-3 py-2 text-sm text-ink-primary hover:bg-elevated transition-colors"
                  >
                    {m.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <div className="rounded-md bg-info-bg border border-border px-3 py-2 text-xs text-info">
            <IconCircleCheck size={12} className="inline mr-1" />
            Specs auto-filled from {selected.label}
          </div>
        )}

        {/* Nickname */}
        <div>
          <label className="label">Nickname <span className="text-ink-tertiary font-normal">(optional)</span></label>
          <input
            className="input"
            placeholder="e.g. The Beast, Workshop P1S"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>

        {/* Manual overrides when not a known model */}
        {!selected && query && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Max nozzle temp (°C)</label>
              <input className="input font-mono" type="number" value={nozzleTemp}
                onChange={(e) => setNozzleTemp(e.target.value)} placeholder="300" />
            </div>
            <div>
              <label className="label">Max bed temp (°C)</label>
              <input className="input font-mono" type="number" value={bedTemp}
                onChange={(e) => setBedTemp(e.target.value)} placeholder="100" />
            </div>
            <div>
              <label className="label">Enclosure</label>
              <div className="flex gap-2">
                {[true, false].map((v) => (
                  <button key={String(v)} type="button"
                    onClick={() => setEnclosure(v)}
                    className={[
                      'flex-1 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors',
                      enclosure === v
                        ? 'bg-accent-subtle border-accent text-accent'
                        : 'bg-elevated border-border text-ink-secondary hover:border-border-strong',
                    ].join(' ')}>
                    {v ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Nozzle material</label>
              <select className="input" value={nozzleMat} onChange={(e) => setNozzleMat(e.target.value)}>
                <option value="brass">Brass</option>
                <option value="hardened_steel">Hardened Steel</option>
                <option value="ruby">Ruby</option>
                <option value="stainless">Stainless</option>
              </select>
            </div>
          </div>
        )}

        {createPrinter.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(createPrinter.error as Error).message}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={createPrinter.isPending} className="btn-primary flex-1 justify-center">
            {createPrinter.isPending ? 'Adding…' : 'Add printer'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Slot assignment modal ─────────────────────────────────────

interface SlotAssignModalProps {
  printer: PrinterDetail
  slotNumber: number
  currentSlot?: SlotInfo
  onClose: () => void
}

function SlotAssignModal({ printer, slotNumber, currentSlot, onClose }: SlotAssignModalProps) {
  const { data: spoolList = [] } = useSpools()
  const assignSlot = useAssignSlot(printer.id)
  const [selectedSpoolId, setSelectedSpoolId] = useState(currentSlot?.slot.spool_id ?? '')

  // Filter to compatible spools (matching diameter, active/reserve)
  const printerDiam = parseFloat(printer.filament_diameter_mm)
  const compatible = spoolList.filter((s) => {
    if (s.status === 'empty' || s.status === 'archived') return false
    // diameter check would require profile join — for now show all active/reserve
    return true
  })

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    await assignSlot.mutateAsync({
      slot: slotNumber,
      data: { spool_id: selectedSpoolId || null, filament_profile_id: null },
    })
    onClose()
  }

  async function handleUnload() {
    await assignSlot.mutateAsync({ slot: slotNumber, data: { spool_id: null, filament_profile_id: null } })
    onClose()
  }

  return (
    <Modal title={`Slot ${slotNumber}`} onClose={onClose}>
      <form onSubmit={handleAssign} className="space-y-4">
        {currentSlot?.slot.spool_id && (
          <div className="flex items-center gap-3 p-3 rounded-md bg-elevated border border-border">
            <div
              className="w-5 h-5 rounded-full border-2 shrink-0"
              style={{ backgroundColor: currentSlot.color_hex ?? '#334155', borderColor: '#2e3e58' }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-primary">{currentSlot.brand} {currentSlot.material}</p>
              <p className="text-xs text-ink-tertiary">{currentSlot.color_name ?? 'No color name'}</p>
            </div>
            <button type="button" onClick={handleUnload} className="btn-ghost text-xs py-1 px-2">
              Unload
            </button>
          </div>
        )}

        <div>
          <label className="label">Load spool</label>
          <select className="input" value={selectedSpoolId}
            onChange={(e) => setSelectedSpoolId(e.target.value)}>
            <option value="">— empty slot —</option>
            {compatible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id.slice(0, 8)} · {s.status}
                {s.filament_remaining_g != null ? ` · ${s.filament_remaining_g.toFixed(0)}g` : ''}
              </option>
            ))}
          </select>
          {printerDiam && (
            <p className="text-xs text-ink-tertiary mt-1">
              Showing spools compatible with {printerDiam}mm diameter
            </p>
          )}
        </div>

        {assignSlot.error && (
          <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
            {(assignSlot.error as Error).message}
          </p>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={assignSlot.isPending} className="btn-primary flex-1 justify-center">
            {assignSlot.isPending ? 'Saving…' : 'Assign slot'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Printer detail view ───────────────────────────────────────

interface PrinterDetailViewProps {
  printer: PrinterDetail
  onBack: () => void
}

function PrinterDetailView({ printer, onBack }: PrinterDetailViewProps) {
  const [slotModal, setSlotModal] = useState<{ number: number; info?: SlotInfo } | null>(null)
  const addAccessory = useAddAccessory(printer.id)
  const [showAccForm, setShowAccForm] = useState(false)
  const [accType, setAccType] = useState('AMS_2_Pro')

  const totalSlots = printer.native_color_slots +
    (printer.accessories?.reduce((acc, a) => acc + (a.slots_added ?? 0), 0) ?? 0)

  const slotMap = new Map<number, SlotInfo>()
  for (const s of printer.slots ?? []) {
    slotMap.set(s.slot.slot_number, s)
  }

  const ACC_TYPES = [
    { value: 'AMS',       label: 'AMS (4 slots)' },
    { value: 'AMS_2_Pro', label: 'AMS 2 Pro (4 slots)' },
    { value: 'AMS_Lite',  label: 'AMS Lite (4 slots, A1/Mini only)' },
    { value: 'AMS_HT',    label: 'AMS HT (1 slot)' },
    { value: 'enclosure', label: 'Enclosure' },
    { value: 'camera',    label: 'Camera' },
    { value: 'LED',       label: 'LED strip' },
    { value: 'other',     label: 'Other' },
  ]

  const SLOT_COUNTS: Record<string, number> = {
    AMS: 4, AMS_2_Pro: 4, AMS_Lite: 4, AMS_HT: 1,
  }

  async function handleAddAccessory(e: React.FormEvent) {
    e.preventDefault()
    await addAccessory.mutateAsync({
      accessory_type: accType,
      slots_added: SLOT_COUNTS[accType] ?? 0,
    })
    setShowAccForm(false)
  }

  return (
    <div>
      <button onClick={onBack} className="btn-ghost mb-4 text-xs py-1 px-2">
        ← Back to printers
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-ink-primary">
            {printer.nickname ?? `${printer.brand} ${printer.model}`}
          </h2>
          <p className="text-xs text-ink-tertiary mt-0.5">
            {printer.brand} {printer.model} · {printer.motion_system ?? 'FDM'} · {statusBadge(printer.status)}
          </p>
        </div>
      </div>

      {/* Specs row */}
      <div className="card mb-4">
        <p className="text-[10px] text-ink-tertiary uppercase font-semibold tracking-wide mb-2">Specs</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Nozzle', `${printer.current_nozzle_diameter_mm}mm ${printer.current_nozzle_material}`],
            ['Nozzle max', printer.max_nozzle_temp_c ? `${printer.max_nozzle_temp_c}°C` : '—'],
            ['Bed max', printer.max_bed_temp_c ? `${printer.max_bed_temp_c}°C` : '—'],
            ['Build vol', printer.build_volume_x_mm
              ? `${printer.build_volume_x_mm}×${printer.build_volume_y_mm}×${printer.build_volume_z_mm}mm`
              : '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] text-ink-tertiary uppercase font-semibold">{label}</p>
              <p className="text-sm text-ink-primary font-mono">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Slot grid */}
      {totalSlots > 0 && (
        <div className="card mb-4">
          <p className="text-[10px] text-ink-tertiary uppercase font-semibold tracking-wide mb-3">
            {printer.multi_color_system ?? 'Color'} Slots ({totalSlots})
          </p>
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: totalSlots }, (_, i) => i + 1).map((n) => {
              const info = slotMap.get(n)
              return (
                <button
                  key={n}
                  onClick={() => setSlotModal({ number: n, info })}
                  className="flex flex-col items-center gap-1.5 group"
                  title={info?.slot.spool_id ? `${info.brand} ${info.material}` : `Slot ${n} — empty`}
                >
                  <div
                    className="w-9 h-9 rounded-full border-2 transition-all group-hover:scale-110 group-hover:border-accent"
                    style={{
                      backgroundColor: info?.color_hex ?? 'transparent',
                      borderColor: info?.slot.spool_id ? '#2e3e58' : '#1e2a3e',
                    }}
                  />
                  <span className="text-[10px] text-ink-tertiary font-mono">{n}</span>
                  {info?.brand && (
                    <span className="text-[9px] text-ink-tertiary max-w-[48px] truncate text-center">
                      {info.material}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Accessories */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] text-ink-tertiary uppercase font-semibold tracking-wide">Accessories</p>
          <button onClick={() => setShowAccForm(!showAccForm)} className="btn-secondary text-xs py-1 px-2">
            <IconPlus size={12} /> Add
          </button>
        </div>

        {showAccForm && (
          <form onSubmit={handleAddAccessory} className="mb-3 p-3 bg-elevated rounded-md space-y-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={accType} onChange={(e) => setAccType(e.target.value)}>
                {ACC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={addAccessory.isPending} className="btn-primary text-xs py-1.5 px-3">
                {addAccessory.isPending ? 'Adding…' : 'Add'}
              </button>
              <button type="button" onClick={() => setShowAccForm(false)} className="btn-ghost text-xs py-1.5 px-3">
                Cancel
              </button>
            </div>
          </form>
        )}

        {(printer.accessories ?? []).length === 0 && !showAccForm ? (
          <p className="text-xs text-ink-tertiary">No accessories yet</p>
        ) : (
          <div className="space-y-1">
            {(printer.accessories ?? []).map((acc) => (
              <div key={acc.id} className="flex items-center justify-between py-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <IconTool size={13} className="text-ink-secondary" />
                  <span className="text-ink-primary">{acc.accessory_type.replace(/_/g, ' ')}</span>
                  {acc.brand && <span className="text-ink-tertiary">· {acc.brand}</span>}
                  {(acc.slots_added ?? 0) > 0 && (
                    <span className="text-ink-tertiary">· +{acc.slots_added} slots</span>
                  )}
                </div>
                {acc.is_installed && <Badge variant="success">Installed</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slot assignment modal */}
      {slotModal && (
        <SlotAssignModal
          printer={printer}
          slotNumber={slotModal.number}
          currentSlot={slotModal.info}
          onClose={() => setSlotModal(null)}
        />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────

export default function PrintersPage() {
  const { data: printers = [], isLoading } = usePrinters()
  const [showAdd, setShowAdd]       = useState(false)
  const [selected, setSelected]     = useState<PrinterDetail | null>(null)

  if (selected) {
    return (
      <AppShell title={selected.nickname ?? `${selected.brand} ${selected.model}`}>
        <PrinterDetailView
          printer={selected}
          onBack={() => setSelected(null)}
        />
      </AppShell>
    )
  }

  return (
    <AppShell title="Printers">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-ink-primary">Printers</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            {printers.length} printer{printers.length !== 1 ? 's' : ''} in your fleet
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <IconPlus size={15} /> Add printer
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2].map((n) => (
            <div key={n} className="card animate-pulse">
              <div className="h-12 bg-elevated rounded-md" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && printers.length === 0 && (
        <div className="card text-center py-12">
          <IconPrinter size={32} className="text-ink-tertiary mx-auto mb-3" stroke={1} />
          <p className="text-ink-secondary text-md font-medium">No printers yet</p>
          <p className="text-ink-tertiary text-xs mt-1">
            Click <strong>Add printer</strong> to start tracking your fleet.
          </p>
        </div>
      )}

      {!isLoading && printers.length > 0 && (
        <div className="space-y-3">
          {printers.map((p) => (
            <PrinterCard
              key={p.id}
              printer={p}
              onViewDetail={() => setSelected(p)}
            />
          ))}
        </div>
      )}

      {showAdd && <AddPrinterModal onClose={() => setShowAdd(false)} />}
    </AppShell>
  )
}
