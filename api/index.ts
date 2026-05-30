import type { IncomingMessage, ServerResponse } from 'http'
import mod from './_server.bundle.cjs'

// Unwrap esbuild CJS default export
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const m = mod as any
const app: { fetch: (req: Request) => Promise<Response> } =
  typeof m?.default?.fetch === 'function' ? m.default : m

export const config = { maxDuration: 30 }

/**
 * Vercel Node.js serverless function — old-style (req, res) handler.
 * Manually bridges Node.js IncomingMessage → Web API Request → ServerResponse
 * so Hono's response is properly flushed back to the client.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Build the full URL
  const host = req.headers.host ?? 'localhost'
  const url = `https://${host}${req.url}`

  // Read raw body
  const rawBody = await new Promise<Buffer>((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })

  // Build Web API Request
  const webReq = new Request(url, {
    method: req.method ?? 'GET',
    headers: req.headers as Record<string, string>,
    body: rawBody.length > 0 ? rawBody : undefined,
  })

  // Call Hono
  const webRes = await app.fetch(webReq)

  // Write status + headers
  res.statusCode = webRes.status
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })

  // Write body
  const buf = Buffer.from(await webRes.arrayBuffer())
  res.end(buf)
}
