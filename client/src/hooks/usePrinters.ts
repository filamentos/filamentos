import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface SlotInfo {
  slot: {
    id: string
    slot_number: number
    slot_label: string | null
    spool_id: string | null
    filament_profile_id: string | null
    accessory_id: string | null
  }
  color_hex: string | null
  color_name: string | null
  brand: string | null
  material: string | null
  spool_status: string | null
}

export interface AccessoryInfo {
  id: string
  accessory_type: string
  brand: string | null
  model: string | null
  unit_index: number | null
  slots_added: number | null
  drying_capable: boolean | null
  is_installed: boolean | null
}

export interface PrinterDetail {
  id: string
  user_id: string
  brand: string
  model: string
  nickname: string | null
  printer_type: string
  motion_system: string | null
  build_volume_x_mm: number | null
  build_volume_y_mm: number | null
  build_volume_z_mm: number | null
  max_nozzle_temp_c: number | null
  max_bed_temp_c: number | null
  has_enclosure: boolean
  filament_diameter_mm: string
  direct_drive: boolean
  current_nozzle_diameter_mm: string
  current_nozzle_material: string
  native_color_slots: number
  multi_color_system: string | null
  status: string
  purchase_date: string | null
  notes: string | null
  created_at: string | null
  accessories: AccessoryInfo[]
  slots: SlotInfo[]
}

export interface PrinterModelRef {
  brand: string
  model: string
  label: string
}

const KEYS = {
  list:   () => ['printers'] as const,
  detail: (id: string) => ['printers', id] as const,
  models: () => ['printers', 'models'] as const,
}

export function usePrinters() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: () => api.get<PrinterDetail[]>('/printers'),
  })
}

export function usePrinter(id: string) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => api.get<PrinterDetail>(`/printers/${id}`),
    enabled: !!id,
  })
}

export function usePrinterModels() {
  return useQuery({
    queryKey: KEYS.models(),
    queryFn: () => api.get<PrinterModelRef[]>('/printers/models'),
    staleTime: Infinity,
  })
}

export function useCreatePrinter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<PrinterDetail>('/printers', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.list() }),
  })
}

export function useUpdatePrinter(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.patch<PrinterDetail>(`/printers/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.list() })
      qc.invalidateQueries({ queryKey: KEYS.detail(id) })
    },
  })
}

export function useDeletePrinter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/printers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.list() }),
  })
}

export function useAddAccessory(printerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post(`/printers/${printerId}/accessories`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.detail(printerId) }),
  })
}

export function useAssignSlot(printerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slot, data }: { slot: number; data: Record<string, unknown> }) =>
      api.patch(`/printers/${printerId}/slots/${slot}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.detail(printerId) }),
  })
}
