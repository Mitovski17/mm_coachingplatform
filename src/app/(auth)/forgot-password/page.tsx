'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('error') === 'invalid_link'
      ? 'That reset link was invalid or has expired. Enter your email below to get a new one.'
      : null
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    })
    if (error) {
      setServerError(error.message)
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-8"
        style={{ backgroundColor: 'var(--color-surface-1)' }}
      >
        <div className="w-full max-w-sm text-center">
          <div
            className="mx-auto mb-6 flex items-center justify-center"
            style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.2)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h2 className="text-2xl mb-3" style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
            Check your email
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            If that email is registered, we&apos;ve sent a password reset link. Check your inbox and follow the link to set a new password.
          </p>
          <a
            href="/login"
            className="text-sm"
            style={{ color: 'var(--color-text-hint)', textDecoration: 'none' }}
          >
            ← Back to login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <div
        className="hidden lg:flex flex-col items-center justify-center w-1/2 px-16"
        style={{ backgroundColor: 'var(--color-base)' }}
      >
        <div className="text-center">
          <h1 className="text-7xl tracking-tight leading-[1.05]" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
            <span className="block">Mitovski</span>
            <span className="block">Coaching</span>
          </h1>
          <p className="mt-6 text-base" style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
            Built for you. Guided by your coach.
          </p>
        </div>
      </div>

      <div
        className="flex flex-1 flex-col items-center justify-center px-8 lg:px-16"
        style={{ backgroundColor: 'var(--color-surface-1)' }}
      >
        <div className="w-full max-w-sm">
          <div className="flex lg:hidden flex-col mb-10">
            <span className="text-2xl leading-tight" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Mitovski</span>
            <span className="text-2xl leading-tight" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Coaching</span>
          </div>

          <h2 className="text-3xl mb-1" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
            Reset password
          </h2>
          <p className="mb-8 text-sm" style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
            Enter your email and we&apos;ll send you a reset link.
          </p>

          {serverError && (
            <div
              className="mb-6 px-4 py-3 text-sm"
              style={{ backgroundColor: 'var(--color-surface-3)', color: 'var(--color-text-secondary)', borderRadius: 'var(--radius-md)' }}
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                suppressHydrationWarning
                className="w-full px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#6B6B6B]"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-secondary)',
                }}
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 text-sm flex items-center justify-center gap-2 transition-colors mt-2 disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                backgroundColor: 'var(--color-text-primary)',
                color: 'var(--color-base)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a href="/login" className="text-sm" style={{ color: 'var(--color-text-hint)', textDecoration: 'none' }}>
              ← Back to login
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
