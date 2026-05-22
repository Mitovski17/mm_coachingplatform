'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Copy, Check } from 'lucide-react'

type Step = 'form' | 'success'

export default function NewClientPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [inviteUrl, setInviteUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role: 'client' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send invite')
        return
      }
      setInviteUrl(data.invite_url)
      setStep('success')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 24px' }}>
      <Link
        href="/coach/dashboard"
        className="inline-flex items-center gap-1.5"
        style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 28 }}
      >
        <ArrowLeft size={14} />
        Back to dashboard
      </Link>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
        Add new client
      </h1>
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 32px' }}>
        Send an invite link to your client. They'll create their account and complete onboarding.
      </p>

      {step === 'form' ? (
        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            padding: 24,
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}
              >
                Client email address
              </label>
              <div
                className="flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  padding: '0 12px',
                }}
              >
                <Mail size={15} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                  required
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 14,
                    color: 'var(--color-text-primary)',
                    padding: '12px 0',
                  }}
                />
              </div>
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 14,
                fontWeight: 700,
                backgroundColor: loading || !email.trim() ? 'var(--color-surface-3)' : 'var(--color-accent)',
                color: loading || !email.trim() ? 'var(--color-text-hint)' : '#fff',
                border: 'none',
                borderRadius: 10,
                cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Generating invite...' : 'Send invite'}
            </button>
          </form>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: 'rgba(34,197,94,0.12)',
              marginBottom: 16,
            }}
          >
            <Check size={22} style={{ color: '#22c55e' }} />
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
            Invite created
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
            Send this link to <strong style={{ color: 'var(--color-text-secondary)' }}>{email}</strong>. It expires in 7 days.
          </p>

          <div
            style={{
              backgroundColor: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 12,
              wordBreak: 'break-all',
              fontSize: 12,
              color: 'var(--color-text-hint)',
              fontFamily: 'monospace',
            }}
          >
            {inviteUrl}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2"
              style={{
                flex: 1,
                padding: '10px',
                fontSize: 13,
                fontWeight: 600,
                backgroundColor: copied ? 'rgba(34,197,94,0.12)' : 'var(--color-surface-2)',
                color: copied ? '#22c55e' : 'var(--color-text-primary)',
                border: '1px solid ' + (copied ? 'rgba(34,197,94,0.3)' : 'var(--color-border)'),
                borderRadius: 10,
                cursor: 'pointer',
                justifyContent: 'center',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/coach/dashboard')}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: 13,
                fontWeight: 600,
                backgroundColor: 'var(--color-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Back to dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
