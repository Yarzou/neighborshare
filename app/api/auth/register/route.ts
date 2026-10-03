import { NextRequest, NextResponse, after } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { isEmailConfigured, sendConfirmationEmail } from '@/lib/email-notifications'

// L'envoi SMTP se termine après la réponse (after) : laisser à Vercel le temps
// de l'achever, y compris avec une seconde tentative.
export const maxDuration = 30

/**
 * Inscription — remplace l'appel client à `supabase.auth.signUp()`.
 *
 * Pourquoi : le mailer intégré de Supabase ne livre plus qu'aux membres de
 * l'équipe du projet (et en anglais). Les voisins ne recevaient jamais leur lien
 * de confirmation et restaient « Waiting for verification ». Ici on crée le
 * compte via l'API admin (`generateLink`, service role), et c'est l'app qui
 * envoie l'email de confirmation par le SMTP Gmail déjà utilisé pour les
 * notifications. Le lien pointe vers /auth/confirm, qui valide le token.
 *
 * Point utile : pour un compte existant **non confirmé**, `generateLink`
 * met à jour le mot de passe et régénère un token — re-remplir le formulaire
 * débloque donc un voisin coincé.
 *
 * Dégradation : sans GMAIL_* on retombe sur `signUp()` classique, donc sur le
 * mailer Supabase (suffisant en dev pour les adresses de l'équipe).
 */

type RegisterBody = {
  email?: unknown
  password?: unknown
  username?: unknown
  full_name?: unknown
  address_display?: unknown
  address_road?: unknown
  address_city?: unknown
  address_lat?: unknown
  address_lng?: unknown
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function str(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 && t.length <= max ? t : null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as RegisterBody | null
  if (!body) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const email = str(body.email)?.toLowerCase() ?? null
  const password = typeof body.password === 'string' ? body.password : ''
  const username = str(body.username, 40)
  const fullName = str(body.full_name, 80)
  const addressDisplay = str(body.address_display, 300)
  const addressLat = num(body.address_lat)
  const addressLng = num(body.address_lng)

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit faire au moins 8 caractères.' }, { status: 400 })
  }
  if (!username || !fullName) {
    return NextResponse.json({ error: 'Pseudo et nom sont obligatoires.' }, { status: 400 })
  }
  if (!addressDisplay || addressLat === null || addressLng === null) {
    return NextResponse.json({ error: 'Veuillez sélectionner votre adresse.' }, { status: 400 })
  }

  // Mêmes clés que l'ancien signUp : le trigger handle_new_user (019) lit
  // raw_user_meta_data pour créer la ligne profiles.
  const metadata = {
    username,
    full_name: fullName,
    address_display: addressDisplay,
    address_road: str(body.address_road, 200),
    address_city: str(body.address_city, 120),
    address_lat: addressLat,
    address_lng: addressLng,
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Repli : pas de SMTP applicatif (ou pas de service role) → mailer Supabase.
  if (!isEmailConfigured() || !serviceRole) {
    const anon = createSupabaseClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await anon.auth.signUp({ email, password, options: { data: metadata } })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 400 })
    }
    return NextResponse.json({ ok: true, via: 'supabase' })
  }

  const admin = createSupabaseClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { data: metadata },
  })

  if (error) {
    const alreadyExists =
      error.code === 'email_exists' || /already been registered/i.test(error.message)
    if (alreadyExists) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cet email. Connectez-vous ou utilisez une autre adresse.' },
        { status: 409 }
      )
    }
    if (error.code === 'weak_password') {
      return NextResponse.json({ error: 'Mot de passe trop faible.' }, { status: 400 })
    }
    console.error('[Register] generateLink failed:', error.code, error.message)
    return NextResponse.json({ error: "L'inscription a échoué. Réessayez dans un instant." }, { status: 500 })
  }

  const tokenHash = data.properties?.hashed_token
  if (!tokenHash) {
    console.error('[Register] generateLink returned no hashed_token')
    return NextResponse.json({ error: "L'inscription a échoué. Réessayez dans un instant." }, { status: 500 })
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/$/, '')
  const confirmUrl = `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=signup`

  // Réponse immédiate, envoi en arrière-plan : un envoi met ~2 s en temps
  // normal et jusqu'à 20 s sur un décrochage réseau. En cas d'échec, le compte
  // existe non confirmé : re-soumettre le formulaire régénère un lien (l'écran
  // de succès le dit).
  after(async () => {
    const sent = await sendConfirmationEmail(email, fullName, confirmUrl)
    if (!sent) console.error('[Register] confirmation email not sent to', email)
  })

  return NextResponse.json({ ok: true, via: 'gmail' })
}
