import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Handles Supabase email links (password recovery, invites, magic links).
//
// Two supported formats, tried in order:
//
// 1. `token_hash` + `type` — set via a custom Supabase email template
//    ({{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery).
//    Verified with verifyOtp, which needs no local browser state, so it
//    works even if the link is opened on a different device/browser than
//    the one that requested it. This is the recommended path.
//
// 2. `code` — the default Supabase email template ({{ .ConfirmationURL }}).
//    Verified with exchangeCodeForSession, which requires the PKCE code
//    verifier that was stored in the browser that made the original
//    request — it will fail if the link is opened elsewhere. Kept as a
//    fallback so nothing breaks before the email template is updated.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/reset-password'

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`)
}
