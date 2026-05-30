import app from '../server/src/index'

// Vercel Node.js runtime — export app.fetch directly.
// Node.js 20+ supports Web API Request/Response natively,
// so no adapter wrapper is needed.
export const config = { maxDuration: 30 }
export default app.fetch
