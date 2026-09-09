import { createServerClient } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'
import { RECOVERY_COOKIE, RECOVERY_COOKIE_MAX_AGE } from '@/lib/recovery-cookie'

// Never cache or prerender: every request carries a one-time token.
export const dynamic = 'force-dynamic'

// Handles Supabase email links (password recovery, invites, magic links).
//
// Recovery is deliberately NOT verified here — see the comment on the recovery
// branch below, and in @/lib/recovery-cookie. Other link types are verified in
// place, idempotently.
//
// Two link formats are supported:
//
// 1. `token_hash` + `type` — custom Supabase email template
//    ({{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery).
//    Needs no local browser state, so it works even when the link is opened on
//    a different device or inside a mail app's in-app browser. Preferred.
//
// 2. `code` — the default template ({{ .ConfirmationURL }}). Requires the PKCE
//    code verifier stored in the browser that made the original request, so it
//    breaks whenever the link is opened elsewhere. Fallback only.

// Only allow same-origin absolute paths. `//evil.com` and `https://evil.com`
// must both be rejected: browsers resolve `${origin}//evil.com` as evil.com,
// which would turn this route into an open redirect.
function safeNext(raw: string | null, fallback: string) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}

// Binds the Supabase client to the response we are about to return, so session
// cookies are written onto the actual redirect rather than relying on the
// request-scoped cookie store surviving it.
function createRouteClient(request: NextRequest, response: NextResponse) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'), '/reset-password')

  // Supabase can bounce back here with an error of its own — a genuinely
  // expired link, or a redirect_to that isn't allow-listed. Pass the reason
  // through instead of attempting to verify nothing and reporting a generic
  // failure.
  const errorCode = searchParams.get('error_code') ?? searchParams.get('error')
  if (errorCode) {
    console.error('[auth/confirm] provider returned an error', {
      errorCode,
      description: searchParams.get('error_description'),
    })
    return NextResponse.redirect(
      `${origin}/forgot-password?error=${encodeURIComponent(errorCode)}`
    )
  }

  // Password recovery: hand the token to the reset page without spending it.
  //
  // Verifying on this GET is what made reset links look expired within seconds
  // of being sent: the token is single-use, so the first fetch of this URL
  // consumes it, and the first fetch is routinely a mail scanner, a link
  // preview, or a prefetch rather than the user. Every later request — the
  // user's real click, a refresh, a second tap — then gets
  // "One-time token not found" / otp_expired.
  //
  // Instead we park the token in a short-lived httpOnly cookie and verify it
  // inside the password-submit server action. That is a POST, which scanners
  // and prefetchers never issue, so the token is spent exactly once, by the
  // person setting the password.
  if (tokenHash && type === 'recovery') {
    const response = NextResponse.redirect(`${origin}${next}`)
    response.cookies.set({
      name: RECOVERY_COOKIE,
      value: tokenHash,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: RECOVERY_COOKIE_MAX_AGE,
    })
    return response
  }

  // Non-recovery links (invite, signup, email change, magic link) still verify
  // here, because there is no later user action to defer to.
  if (tokenHash && type) {
    const response = NextResponse.redirect(`${origin}${next}`)
    const supabase = createRouteClient(request, response)

    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return response

    // A duplicate request (prefetch, refresh, double-tap) fails even though the
    // first one succeeded and left a valid session. Don't punish the user for
    // that — if they're already signed in, the link did its job.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return response

    console.error('[auth/confirm] verifyOtp(token_hash) failed', { type, error: error.message })
  }

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`)
    const supabase = createRouteClient(request, response)

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return response

    const { data: { user } } = await supabase.auth.getUser()
    if (user) return response

    console.error('[auth/confirm] exchangeCodeForSession(code) failed', { error: error.message })
  }

  return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`)
}
