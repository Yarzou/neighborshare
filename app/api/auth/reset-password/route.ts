import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Soumission du nouveau mot de passe (parcours « mot de passe oublié »).
 *
 * Le lien reçu par email mène au formulaire sans rien valider : c'est ici,
 * et seulement ici, que le token est consommé (`verifyOtp`), immédiatement
 * suivi du changement de mot de passe (`updateUser`). Il n'existe donc aucune
 * session « de récupération » avant que le mot de passe soit changé : un
 * second clic sur le lien réaffiche le formulaire, un antispam qui pré-visite
 * le lien ne consomme rien, et personne n'arrive connecté sans avoir rien fait.
 *
 * `verifyOtp` réussi pose les cookies de session via le client serveur : la
 * réponse 200 laisse l'utilisateur connecté avec son nouveau mot de passe.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token_hash?: unknown; password?: unknown } | null
  const tokenHash = typeof body?.token_hash === 'string' ? body.token_hash : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!tokenHash) {
    return NextResponse.json({ error: 'Lien invalide.', code: 'invalid_link' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit faire au moins 8 caractères.' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
  if (verifyError) {
    console.error('[ResetPassword] verifyOtp failed:', verifyError.code, verifyError.message)
    return NextResponse.json(
      { error: 'Ce lien est invalide, expiré ou déjà utilisé. Refaites une demande.', code: 'invalid_link' },
      { status: 400 }
    )
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    // Le token est consommé mais le mot de passe inchangé : l'utilisateur est
    // connecté avec l'ancien — on le signale, il refera une demande si besoin.
    console.error('[ResetPassword] updateUser failed:', updateError.code, updateError.message)
    const message =
      updateError.code === 'same_password'
        ? "Le nouveau mot de passe doit être différent de l'ancien."
        : updateError.code === 'weak_password'
          ? 'Mot de passe trop faible.'
          : 'La mise à jour a échoué. Refaites une demande de renouvellement.'
    await supabase.auth.signOut()
    return NextResponse.json({ error: message, code: updateError.code ?? 'update_failed' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
