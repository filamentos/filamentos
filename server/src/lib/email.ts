import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173'

export async function sendMagicLink(email: string, token: string): Promise<void> {
  const url = `${APP_URL}/api/auth/verify?token=${token}`

  await resend.emails.send({
    from: 'FilamentOS <noreply@filamentos.app>',
    to: email,
    subject: 'Your FilamentOS sign-in link',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#15803d">FilamentOS</h2>
        <p>Click the button below to sign in. This link expires in <strong>15 minutes</strong>.</p>
        <a href="${url}"
           style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin:16px 0">
          Sign in to FilamentOS
        </a>
        <p style="color:#6b7280;font-size:13px">
          Or copy this link:<br/>
          <span style="font-family:monospace;font-size:12px">${url}</span>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="color:#9ca3af;font-size:12px">
          If you didn't request this, you can safely ignore it.
        </p>
      </div>
    `,
  })
}
