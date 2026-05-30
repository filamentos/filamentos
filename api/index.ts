import mod from './_server.bundle.cjs'

// esbuild CJS output wraps the default export under .default
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m = mod as any
const app: { fetch: (req: Request, ...args: unknown[]) => Promise<Response> } =
  typeof m?.default?.fetch === 'function' ? m.default : m

export const config = { maxDuration: 30 }

// Explicit async function signature so Vercel recognises this as a
// Web-API Request→Response handler (not the old VercelRequest/VercelResponse style).
export default async function handler(req: Request): Promise<Response> {
  return app.fetch(req)
}
