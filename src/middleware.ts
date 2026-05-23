import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Dev mock auth ────────────────────────────────────────────────────────────
// Set MOCK_USER in .env.local to bypass Supabase login locally.
// Accepted values: coach | client_fresh | client_done
const MOCK_EMAILS = {
  coach: 'seed_coach@mitovski.dev',
  client_fresh: 'seed_client_fresh@mitovski.dev',
  client_done: 'seed_client_done@mitovski.dev',
} as const

type MockUser = keyof typeof MOCK_EMAILS

function handleMockAuth(request: NextRequest): NextResponse | null {
  const mockUser = process.env.MOCK_USER as MockUser | undefined
  if (process.env.NODE_ENV !== 'development' || !mockUser || !(mockUser in MOCK_EMAILS)) {
    return null
  }

  const { pathname } = request.nextUrl
  const email = MOCK_EMAILS[mockUser]

  // On login page, redirect to the appropriate dashboard
  if (pathname === '/login') {
    const dest = request.nextUrl.clone()
    dest.pathname = mockUser === 'coach' ? '/coach/dashboard' : '/client'
    return NextResponse.redirect(dest)
  }

  // For all other routes, skip Supabase session checks and stamp the mock email
  // as a readable cookie so client components can identify the acting user
  const response = NextResponse.next({ request })
  response.cookies.set('dev_mock_email', email, { sameSite: 'lax', path: '/' })
  return response
}

// Copy all cookies from a supabaseResponse onto any redirect response so that
// refreshed session tokens are never lost when we redirect.
function copySupabaseCookies(from: NextResponse, to: NextResponse): void {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, {
      sameSite: 'lax',
      path: '/',
      httpOnly: cookie.name.startsWith('sb-'),
      secure: process.env.NODE_ENV === 'production',
    })
  })
}

export async function middleware(request: NextRequest) {
  const mockResponse = handleMockAuth(request)
  if (mockResponse) return mockResponse

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not add logic between createServerClient and getUser
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isProtected =
    pathname.startsWith('/coach') ||
    pathname.startsWith('/client') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/check-in')
  const isAdminRoute = pathname.startsWith('/admin')
  const isLoginPage = pathname === '/login'
  const isRoot = pathname === '/'

  // Unauthenticated users trying to access protected routes → login
  if ((isProtected || isAdminRoute) && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    const redirectRes = NextResponse.redirect(loginUrl)
    copySupabaseCookies(supabaseResponse, redirectRes)
    return redirectRes
  }

  // Admin routes: verify the user is in platform_admins
  if (isAdminRoute && user) {
    const { data: adminRow } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single()

    if (!adminRow) {
      const forbiddenUrl = request.nextUrl.clone()
      forbiddenUrl.pathname = '/coach/dashboard'
      const redirectRes = NextResponse.redirect(forbiddenUrl)
      copySupabaseCookies(supabaseResponse, redirectRes)
      return redirectRes
    }
  }

  // Authenticated users on the login page → route by role
  if (isLoginPage && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = profile ? '/coach/dashboard' : '/client'
    const redirectRes = NextResponse.redirect(dashboardUrl)
    copySupabaseCookies(supabaseResponse, redirectRes)
    return redirectRes
  }

  // Authenticated users on the root → route by role immediately (no extra round-trip)
  if (isRoot && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    const destUrl = request.nextUrl.clone()
    destUrl.pathname = profile ? '/coach/dashboard' : '/client'
    const redirectRes = NextResponse.redirect(destUrl)
    copySupabaseCookies(supabaseResponse, redirectRes)
    return redirectRes
  }

  // Unauthenticated users on the root → login
  if (isRoot && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    const redirectRes = NextResponse.redirect(loginUrl)
    copySupabaseCookies(supabaseResponse, redirectRes)
    return redirectRes
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
