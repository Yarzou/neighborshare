import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PASSWORD_RESET_COOKIE, PASSWORD_RESET_PATH } from '@/lib/auth-flow'

// Chemins qui restent accessibles pendant un renouvellement de mot de passe
// (la page elle-même, les routes API, la validation du lien).
const RESET_ALLOWED_PREFIXES = [PASSWORD_RESET_PATH, '/api/', '/auth/confirm']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getSession() reads the JWT from cookies without a network call — more reliable
  // than getUser() in middleware where network failures cause false logouts.
  const { data: { session } } = await supabase.auth.getSession()

  // Session ouverte par un lien « mot de passe oublié » : elle ne sert qu'à
  // changer le mot de passe. Tant que le cookie est là, tout mène à la page
  // de renouvellement (posé par /auth/confirm, effacé par la page au succès).
  const resetPending = request.cookies.get(PASSWORD_RESET_COOKIE)?.value === '1'
  if (resetPending) {
    const { pathname } = request.nextUrl
    if (session && !RESET_ALLOWED_PREFIXES.some(p => pathname.startsWith(p))) {
      const redirectResponse = NextResponse.redirect(new URL(PASSWORD_RESET_PATH, request.url))
      supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value)
      })
      return redirectResponse
    }
    if (!session) {
      // Cookie orphelin (session expirée ou déconnexion) : on le retire.
      supabaseResponse.cookies.set(PASSWORD_RESET_COOKIE, '', { path: '/', maxAge: 0 })
    }
  }

  const protectedPaths: string[] = []  // Auth gérée côté client (comme /profile et /messages)
  const isProtected = protectedPaths.some(p => request.nextUrl.pathname.startsWith(p))

  if (isProtected && !session) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    const redirectResponse = NextResponse.redirect(url)
    // Forward any refreshed session cookies so the browser stays in sync
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value)
    })
    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
