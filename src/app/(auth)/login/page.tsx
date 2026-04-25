'use client'

import { useState, forwardRef, FocusEvent, InputHTMLAttributes } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginValues = z.infer<typeof loginSchema>

const InputField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function InputField({ onBlur, ...props }, ref) {
    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.border = '1px solid var(--color-border)'
      onBlur?.(e)
    }
    return (
      <input
        ref={ref}
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

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginValues) => {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setServerError(error.message)
      return
    }
    router.push('/coach/dashboard')
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
        className="flex flex-1 flex-col items-center justify-center px-8 lg:px-16"
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
            Welcome back
          </h2>
          <p
            className="mb-8 text-sm"
            style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}
          >
            Sign in to your coaching dashboard
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
                htmlFor="email"
                className="block text-sm mb-2"
                style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}
              >
                Email
              </label>
              <InputField
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {errors.email.message}
                </p>
              )}
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
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {errors.password.message}
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
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
