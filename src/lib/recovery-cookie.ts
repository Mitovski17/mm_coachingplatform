// Short-lived, httpOnly cookie that carries a Supabase password-recovery
// token_hash from /auth/confirm (the link click) to the server action that
// actually sets the new password.
//
// Why it exists: a recovery token is single-use. If it is verified during the
// GET that follows the email link, whoever fetches that URL first burns it —
// and that is very often not the user (mail providers, link/virus scanners,
// iOS and Android link previews, and browser prefetch all fetch it). The
// user's own click then fails with `otp_expired`, which reads as "this link
// expired" seconds after it was sent. Parking the token here and consuming it
// on the password-submit POST removes that whole class of failure.
export const RECOVERY_COOKIE = 'mc-recovery-token'

// Matches Supabase's default recovery token lifetime (1 hour). The token
// itself remains the source of truth — this only bounds how long we hold it.
export const RECOVERY_COOKIE_MAX_AGE = 60 * 60
