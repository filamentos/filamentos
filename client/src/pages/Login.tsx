import { useState } from 'react'
import { api } from '../lib/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/request-link', { email })
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="w-full max-w-[340px]">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-accent-strong flex items-center justify-center mb-4">
            <span className="text-white font-black text-xl leading-none select-none">F</span>
          </div>
          <h1 className="text-lg font-bold text-ink-primary tracking-tight">FilamentOS</h1>
          <p className="mt-1 text-xs text-ink-tertiary">Inventory OS for makers</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-xl p-6">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-success-bg flex items-center justify-center mx-auto">
                <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 text-success" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-8" />
                </svg>
              </div>
              <p className="text-md font-semibold text-ink-primary">Check your inbox</p>
              <p className="text-xs text-ink-secondary leading-relaxed">
                We sent a magic link to{' '}
                <span className="text-accent font-medium">{email}</span>.
                <br />
                It expires in 15 minutes.
              </p>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className="text-xs text-ink-tertiary hover:text-ink-secondary transition-colors mt-2"
              >
                Use a different address
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-md font-semibold text-ink-primary mb-1">Sign in</p>
                <p className="text-xs text-ink-secondary">
                  Enter your email — we'll send a one-click link.
                </p>
              </div>

              <div>
                <label htmlFor="email" className="label">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-xs text-danger bg-danger-bg rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center"
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-ink-tertiary mt-5">
          Invite-only · Need access? Ask an admin.
        </p>
      </div>
    </div>
  )
}
