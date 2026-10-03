import { NextRequest, NextResponse, after } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { isEmailConfigured, sendPasswordResetEmail } from '@/lib/email-notifications'

// L'envoi SMTP se termine après la réponse (after) : laisser à Vercel le temps
// de l'achever, y compris avec une seconde tentative.
export const maxDuration = 30

/**
 * Mot de passe oublié — pendant de /api/auth/register.
 *
 * Génère un lien de récupération via l'API admin (`generateLink` type
 * `recovery`) et l'envoie par le SMTP Gmail de l'app, le mailer intégré de
 * Supabase ne livrant qu'aux membres de l'équipe. Le lien passe par
 * /auth/confirm (qui pose la session) puis /auth/reset-password.
 *
 * Répond toujours 200 pour un email inconnu : on ne révèle pas quelles adresses
 * ont un compte. L'envoi SMTP se fait après la réponse (`after`), donc un échec
 * d'envoi n'est que journalisé — l'écran de succès invite à refaire la demande.
 *
 * Dégradation : sans GMAIL_* on retombe sur `resetPasswordForEmail()` (mailer
 * Supabase, suffisant en dev pour les adresses de l'équipe).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESET_PATH = '/auth/reset-password'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/$/, '')

  if (!isEmailConfigured() || !serviceRole) {
    const anon = createSupabaseClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await anon.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}${RESET_PATH}`,
    })
    if (error && error.code !== 'user_not_found') {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 400 })
    }
    return NextResponse.json({ ok: true, via: 'supabase' })
  }

  const admin = createSupabaseClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })

  if (error) {
    // Email inconnu : même réponse qu'un succès, sans envoi.
    if (error.code === 'user_not_found' || error.status === 404) {
      return NextResponse.json({ ok: true })
    }
    console.error('[ForgotPassword] generateLink failed:', error.code, error.message)
    return NextResponse.json({ error: "La demande a échoué. Réessayez dans un instant." }, { status: 500 })
  }

  const tokenHash = data.properties?.hashed_token
  if (!tokenHash) {
    console.error('[ForgotPassword] generateLink returned no hashed_token')
    return NextResponse.json({ error: "La demande a échoué. Réessayez dans un instant." }, { status: 500 })
  }

  const resetUrl =
    `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}` +
    `&type=recovery&next=${encodeURIComponent(RESET_PATH)}`

  const fullName =
    (data.user?.user_metadata?.full_name as string | undefined) ??
    (data.user?.user_metadata?.username as string | undefined) ??
    null

  after(async () => {
    const sent = await sendPasswordResetEmail(email, fullName, resetUrl)
    if (!sent) console.error('[ForgotPassword] reset email not sent to', email)
  })

  return NextResponse.json({ ok: true, via: 'gmail' })
}
