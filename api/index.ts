// This file is the Vercel serverless function entry point.
// The server is pre-bundled by esbuild (see root package.json build script)
// into api/_server.bundle.js — a single, self-contained ESM file.
import app from './_server.bundle.js'

export const config = { maxDuration: 30 }
export default app.fetch
