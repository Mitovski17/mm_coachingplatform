'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // This app uses createBrowserClient from @supabase/ssr, which defaults to
  // the PKCE flow. That means the recovery link lands here with a `?code=`
  // query param, not an `#access_token` hash — the SDK does NOT exchange
  // that code for a session automatically, so PASSWORD_RECOVERY never fires
  // on its own and the page was stuck on the loading spinner forever.
  useEffect(() => {
    const supabase = createClient()

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setServerError('This reset link is invalid or has expired. Please request a new one.')
          return
        }
        setReady(true)
      })
    }

    // Fallback for hash-based recovery links (older Supabase configs),
    // which the SDK does pick up automatically and surfaces as this event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const onSubmit = async (data: FormValues) => {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) {
      setServerError(error.message)
      return
    }
    setDone(true)
    setTimeout(() => router.replace('/login'), 2500)
  }

  if (done) {
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
              backgroundColor: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h2 className="text-2xl mb-3" style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
            Password updated
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Your password has been changed. Redirecting you to login…
          </p>
        </div>
      </div>
    )
  }

  if (!ready && serverError) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-8"
        style={{ backgroundColor: 'var(--color-surface-1)' }}
      >
        <div className="w-full max-w-sm text-center">
          <h2 className="text-2xl mb-3" style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}>
            Link expired
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            {serverError}
          </p>
          <a
            href="/forgot-password"
            className="text-sm"
            style={{ color: 'var(--color-text-hint)', textDecoration: 'none' }}
          >
            ← Request a new link
          </a>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: 'var(--color-surface-1)' }}
      >
        <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--color-text-hint)' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.961 3 8.12l3-2.829z" />
        </svg>
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
            Set new password
          </h2>
          <p className="mb-8 text-sm" style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
            Choose a strong password for your account.
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
              <label htmlFor="password" className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                New password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                suppressHydrationWarning
                className="w-full px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-secondary)',
                }}
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                suppressHydrationWarning
                className="w-full px-4 py-3 text-sm outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-secondary)',
                }}
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{errors.confirmPassword.message}</p>
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
              {isSubmitting ? 'Saving…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
