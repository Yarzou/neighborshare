import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Cible du lien de confirmation envoyé par /api/auth/register.
 * Valide le token côté serveur (`verifyOtp`), ce qui confirme l'email et pose
 * les cookies de session via le client serveur — l'utilisateur arrive connecté.
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

  const failure = NextResponse.redirect(new URL('/auth/login?erreur=confirmation', origin))

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return failure
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

  if (error) {
    console.error('[Confirm] verifyOtp failed:', error.code, error.message)
    return failure
  }

  return NextResponse.redirect(new URL(next, origin))
}
