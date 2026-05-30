import _bundle from './_server.bundle.cjs'

// esbuild CJS output with __esModule:true wraps the default export.
// Handle both shapes: { default: app } and app directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mod = _bundle as any
const app: { fetch: (req: Request) => Promise<Response> } =
  typeof mod?.default?.fetch === 'function' ? mod.default : mod

export const config = { maxDuration: 30 }
export default app.fetch
