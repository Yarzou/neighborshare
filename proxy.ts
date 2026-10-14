import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

  // L'appli installée s'ouvre sur « / » (start_url du manifeste) : un voisin connecté
  // part tout de suite vers son accueil, sans rendre la page publique ni attendre le
  // getUser() de `app/page.tsx`, qui interroge le serveur d'auth (2026-10-14). Une
  // session invalide n'ouvre rien pour autant : /accueil la vérifie et renvoie à la
  // connexion.
  if (session && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/accueil'
    const redirectResponse = NextResponse.redirect(url)
    // Jeton éventuellement rafraîchi par getSession() : on le transmet, options comprises.
    supabaseResponse.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie))
    return redirectResponse
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
