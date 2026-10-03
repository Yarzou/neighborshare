import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Cible du lien de confirmation d'inscription envoyé par /api/auth/register.
 * Valide le token côté serveur (`verifyOtp`), ce qui confirme l'email et pose
 * les cookies de session via le client serveur — l'utilisateur arrive connecté.
 *
 * Le renouvellement de mot de passe ne passe pas par ici : son lien mène au
 * formulaire, et le token n'est consommé qu'à la soumission
 * (POST /api/auth/reset-password).
 *
 * Lien déjà consommé (second clic, pré-visite par un antispam) alors qu'une
 * session existe : l'email est déjà confirmé, on va à l'accueil plutôt que
 * d'afficher une erreur.
 */

const ALLOWED_TYPES: EmailOtpType[] = ['signup', 'email', 'invite', 'magiclink', 'email_change']

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
      return NextResponse.redirect(new URL(next, origin))
    }
    console.error('[Confirm] verifyOtp failed:', error.code, error.message)
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    return NextResponse.redirect(new URL('/accueil', origin))
  }

  return NextResponse.redirect(new URL('/auth/login?erreur=confirmation', origin))
}
