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
    dest.pathname = mockUser === 'coach' ? '/coach/dashboard' : '/check-in'
    return NextResponse.redirect(dest)
  }

  // For all other routes, skip Supabase session checks and stamp the mock email
  // as a readable cookie so client components can identify the acting user
  const response = NextResponse.next({ request })
  response.cookies.set('dev_mock_email', email, { sameSite: 'lax', path: '/' })
  return response
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

  const isProtected = pathname.startsWith('/coach') || pathname.startsWith('/client') || pathname.startsWith('/onboarding') || pathname.startsWith('/check-in')
  const isLoginPage = pathname === '/login'

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  if (isLoginPage && user) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/coach/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
