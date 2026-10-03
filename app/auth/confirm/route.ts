import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { PASSWORD_RESET_COOKIE, PASSWORD_RESET_PATH } from '@/lib/auth-flow'

/**
 * Cible des liens envoyés par /api/auth/register et /api/auth/forgot-password.
 * Valide le token côté serveur (`verifyOtp`), ce qui confirme l'email et pose
 * les cookies de session via le client serveur — l'utilisateur arrive connecté.
 *
 * Récupération de mot de passe : la session ouverte par le lien ne doit servir
 * qu'à changer le mot de passe. On pose le cookie PASSWORD_RESET_COOKIE ;
 * proxy.ts renvoie alors toute navigation vers /auth/reset-password tant que
 * le mot de passe n'a pas été changé (la page efface le cookie au succès).
 *
 * Lien déjà consommé (second clic, pré-visite par un antispam) : on ne jette
 * pas l'utilisateur sur la page de connexion s'il est déjà au milieu du
 * parcours — on le remet là où il en était.
 */

const ALLOWED_TYPES: EmailOtpType[] = ['signup', 'email', 'recovery', 'invite', 'magiclink', 'email_change']

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/accueil'
  return value
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))

  const supabase = await createClient()

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

    if (!error) {
      if (type === 'recovery') {
        const res = NextResponse.redirect(new URL(PASSWORD_RESET_PATH, origin))
        res.cookies.set(PASSWORD_RESET_COOKIE, '1', {
          path: '/',
          maxAge: 60 * 60,
          sameSite: 'lax',
          secure: origin.startsWith('https://'),
          // Lisible côté client : la page de nouveau mot de passe l'efface au succès.
          httpOnly: false,
        })
        return res
      }
      return NextResponse.redirect(new URL(next, origin))
    }

    console.error('[Confirm] verifyOtp failed:', error.code, error.message)
  }

  // Token absent, invalide ou déjà utilisé : où en est l'utilisateur ?
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    const pendingReset = req.cookies.get(PASSWORD_RESET_COOKIE)?.value === '1'
    return NextResponse.redirect(new URL(pendingReset ? PASSWORD_RESET_PATH : '/accueil', origin))
  }

  return NextResponse.redirect(new URL('/auth/login?erreur=confirmation', origin))
}
