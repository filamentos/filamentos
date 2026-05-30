const BASE = '/api'

/** Shape returned by all new filament routes */
export type ApiResponse<T> = { data: T; error: null } | { data: null; error: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  const body = await res.json().catch(() => ({})) as Record<string, unknown>

  if (!res.ok) {
    throw new Error((body['error'] as string | undefined) ?? `HTTP ${res.status}`)
  }

  // Unwrap { data } envelope when present
  if ('data' in body && body['data'] !== undefined) {
    return body['data'] as T
  }

  return body as T
}

export const api = {
  get:    <T>(path: string)                   => request<T>(path),
  post:   <T>(path: string, data?: unknown)   => request<T>(path, { method: 'POST',   body: data ? JSON.stringify(data) : undefined }),
  patch:  <T>(path: string, data: unknown)    => request<T>(path, { method: 'PATCH',  body: JSON.stringify(data) }),
  delete: <T>(path: string)                   => request<T>(path, { method: 'DELETE' }),
}
