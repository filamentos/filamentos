import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Alert } from '@shared/types'

export const ALERT_KEYS = {
  all: () => ['alerts'] as const,
}

export function useAlerts() {
  return useQuery({
    queryKey: ALERT_KEYS.all(),
    queryFn: () => api.get<Alert[]>('/alerts'),
    refetchInterval: 60_000, // poll every minute
  })
}

export function useDismissAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/alerts/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ALERT_KEYS.all() }),
  })
}

export function useMarkAlertRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/alerts/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ALERT_KEYS.all() }),
  })
}

export function useEvaluateAlerts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/alerts/evaluate'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ALERT_KEYS.all() }),
  })
}
