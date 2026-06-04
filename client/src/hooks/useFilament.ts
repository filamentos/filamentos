import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type {
  FilamentProfile,
  FilamentProfileWithCounts,
  FilamentProfileDetail,
  SpoolWithRemaining,
} from '../lib/filamentTypes'

// ── Query keys ────────────────────────────────────────────────

export const FILAMENT_KEYS = {
  profiles:     () => ['filament', 'profiles'] as const,
  profile:      (id: string) => ['filament', 'profiles', id] as const,
  spools:       (profileId?: string) => ['filament', 'spools', profileId ?? 'all'] as const,
  spoolLogs:    (spoolId: string) => ['filament', 'spools', spoolId, 'logs'] as const,
}

// ── Profiles ──────────────────────────────────────────────────

export function useProfiles() {
  return useQuery({
    queryKey: FILAMENT_KEYS.profiles(),
    queryFn: () => api.get<FilamentProfileWithCounts[]>('/filament/profiles'),
  })
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: FILAMENT_KEYS.profile(id),
    queryFn: () => api.get<FilamentProfileDetail>(`/filament/profiles/${id}`),
    enabled: !!id,
  })
}

export function useCreateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<FilamentProfile>) =>
      api.post<FilamentProfile>('/filament/profiles', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: FILAMENT_KEYS.profiles() }),
  })
}

export function useUpdateProfile(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<FilamentProfile>) =>
      api.patch<FilamentProfile>(`/filament/profiles/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FILAMENT_KEYS.profiles() })
      qc.invalidateQueries({ queryKey: FILAMENT_KEYS.profile(id) })
    },
  })
}

export function useDeleteProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`/filament/profiles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: FILAMENT_KEYS.profiles() }),
  })
}

// ── Spools ────────────────────────────────────────────────────

export function useSpools(profileId?: string) {
  const qs = profileId ? `?profile_id=${profileId}` : ''
  return useQuery({
    queryKey: FILAMENT_KEYS.spools(profileId),
    queryFn: () => api.get<SpoolWithRemaining[]>(`/filament/spools${qs}`),
  })
}

export function useCreateSpool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/filament/spools', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filament'] }),
  })
}

export function useReceiveSpool() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ spoolId, opening_gross_weight_g }: { spoolId: string; opening_gross_weight_g?: number }) =>
      api.post(`/filament/spools/${spoolId}/receive`, { opening_gross_weight_g }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filament'] }),
  })
}

export function useWeighSpool(spoolId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      gross_weight_g: number
      event_type?: 'weigh' | 'pre_print' | 'post_print'
      slicer_estimate_g?: number
      notes?: string
    }) => api.post(`/filament/spools/${spoolId}/weigh`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['filament'] })
    },
  })
}

export function usePromoteSpool(spoolId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { bare_gross_weight_g: number }) =>
      api.post(`/filament/spools/${spoolId}/promote`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['filament'] }),
  })
}

export interface EmptyTareResult {
  needs_confirmation?: boolean
  new_weight_g?: number
  current_average_g?: number
  empty_spool_weight_g?: number
  sample_count?: number
}

export function useEmptyTare(spoolId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { empty_weight_g: number; confirm?: boolean }) =>
      api.post<EmptyTareResult>(`/filament/spools/${spoolId}/empty-tare`, data),
    onSuccess: (res) => {
      // Only invalidate when an actual save happened (not a confirmation prompt)
      if (!res.needs_confirmation) qc.invalidateQueries({ queryKey: ['filament'] })
    },
  })
}

export function useSwapSpool(spoolId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      final_gross_weight_g?: number
      opening_gross_weight_g?: number
    }) => api.post(`/filament/spools/${spoolId}/swap`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['filament'] })
    },
  })
}
