'use client'

import { useState, useEffect, forwardRef, FocusEvent, InputHTMLAttributes } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createClient as createPublicClient } from '@supabase/supabase-js'
import { createClientFromInvite } from '../actions'

const signupSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type SignupValues = z.infer<typeof signupSchema>

type InviteStatus =
  | { kind: 'loading' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'valid'; inviteId: string; email: string }

const InputField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function InputField({ onBlur, ...props }, ref) {
    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.border = '1px solid var(--color-border)'
      onBlur?.(e)
    }
    return (
      <input
        ref={ref}
        suppressHydrationWarning
        className="w-full px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#6B6B6B]"
        style={{
          backgroundColor: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-secondary)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = '1px solid var(--color-border-strong)'
        }}
        onBlur={handleBlur}
        {...props}
      />
    )
  }
)

export default function InvitePage() {
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params.token

  const [invite, setInvite] = useState<InviteStatus>({ kind: 'loading' })
  const [serverError, setServerError] = useState<string | null>(null)
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
  })

  useEffect(() => {
    const validate = async () => {
      const supabase = createPublicClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await supabase
        .from('invites')
        .select('id, email, accepted_at, expires_at')
        .eq('token', token)
        .single()

      if (error || !data) {
        setInvite({ kind: 'invalid', reason: 'This invite link is invalid.' })
        return
      }

      if (data.accepted_at) {
        setInvite({ kind: 'invalid', reason: 'This invite has already been used.' })
        return
      }

      if (new Date(data.expires_at) <= new Date()) {
        setInvite({ kind: 'invalid', reason: 'This invite has expired.' })
        return
      }

      setInvite({ kind: 'valid', inviteId: data.id, email: data.email })
      setValue('email', data.email)
    }

    validate()
  }, [token, setValue])

  const onSubmit = async (data: SignupValues) => {
    if (invite.kind !== 'valid') return
    setServerError(null)

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.fullName } },
    })

    if (signUpError) {
      setServerError(signUpError.message)
      return
    }

    await supabase
      .from('invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.inviteId)

    // Create the clients row so the client can access the platform immediately
    await createClientFromInvite(invite.inviteId, data.email, data.fullName)

    setSignedUpEmail(data.email)
  }

  if (signedUpEmail) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-8"
        style={{ backgroundColor: 'var(--color-surface-1)' }}
      >
        <div className="w-full max-w-sm text-center">
          <div
            className="mx-auto mb-6 flex items-center justify-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.2)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h2
            className="text-2xl mb-3"
            style={{ color: 'var(--color-text-primary)', fontWeight: 700 }}
          >
            Check your email
          </h2>
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            We sent a verification link to
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
            {signedUpEmail}
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-hint)', lineHeight: 1.6 }}>
            Click the link in the email to verify your account, then you can log in and complete your profile.
          </p>
        </div>
      </div>
    )
  }

  if (invite.kind === 'loading') {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: 'var(--color-surface-1)' }}
      >
        <svg
          className="animate-spin h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ color: 'var(--color-text-hint)' }}
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.961 3 8.12l3-2.829z"
          />
        </svg>
      </div>
    )
  }

  if (invite.kind === 'invalid') {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-8"
        style={{ backgroundColor: 'var(--color-surface-1)' }}
      >
        <div className="w-full max-w-sm text-center">
          <svg
            className="mx-auto mb-5 h-10 w-10"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
            style={{ color: 'var(--color-text-hint)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <h2
            className="text-2xl mb-3"
            style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
          >
            Link unavailable
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {invite.reason}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — hidden on mobile */}
      <div
        className="hidden lg:flex flex-col items-center justify-center w-1/2 px-16"
        style={{ backgroundColor: 'var(--color-base)' }}
      >
        <div className="text-center">
          <h1
            className="text-7xl tracking-tight leading-[1.05]"
            style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
          >
            <span className="block">Mitovski</span>
            <span className="block">Coaching</span>
          </h1>
          <p
            className="mt-6 text-base"
            style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}
          >
            The platform built for serious coaches.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div
        className="flex flex-1 flex-col items-center justify-center px-8 lg:px-16 py-12"
        style={{ backgroundColor: 'var(--color-surface-1)' }}
      >
        <div className="w-full max-w-sm">
          {/* Mobile wordmark */}
          <div className="flex lg:hidden flex-col mb-10">
            <span
              className="text-2xl leading-tight"
              style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
            >
              Mitovski
            </span>
            <span
              className="text-2xl leading-tight"
              style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
            >
              Coaching
            </span>
          </div>

          <h2
            className="text-3xl mb-1"
            style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
          >
            Create your account
          </h2>
          <p
            className="mb-8 text-sm"
            style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}
          >
            You&apos;ve been invited to join Mitovski Coaching.
          </p>

          {serverError && (
            <div
              className="mb-6 px-4 py-3 text-sm"
              style={{
                backgroundColor: 'var(--color-surface-3)',
                color: 'var(--color-text-secondary)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm mb-2"
                style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}
              >
                Full name
              </label>
              <InputField
                id="fullName"
                type="text"
                placeholder="Jane Smith"
                autoComplete="name"
                {...register('fullName')}
              />
              {errors.fullName && (
                <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm mb-2"
                style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                readOnly
                className="w-full px-4 py-3 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-hint)',
                  cursor: 'default',
                }}
                {...register('email')}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm mb-2"
                style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}
              >
                Password
              </label>
              <InputField
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm mb-2"
                style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}
              >
                Confirm password
              </label>
              <InputField
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {errors.confirmPassword.message}
                </p>
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
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-3)'
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'var(--color-text-primary)'
                  e.currentTarget.style.color = 'var(--color-base)'
                }
              }}
              onMouseDown={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-2)'
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                }
              }}
              onMouseUp={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-3)'
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                }
              }}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 flex-shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 22 6.477 22 12h-4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.961 3 8.12l3-2.829z"
                    />
                  </svg>
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
