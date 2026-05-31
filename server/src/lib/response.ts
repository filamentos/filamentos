import type { Context } from 'hono'

/** All successful API responses: { data: T } */
export function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ data, error: null }, status)
}

/** All error API responses: { error: string } */
export function err(c: Context, message: string, status: 400 | 401 | 403 | 404 | 409 | 429 | 500 = 400) {
  return c.json({ data: null, error: message }, status)
}
