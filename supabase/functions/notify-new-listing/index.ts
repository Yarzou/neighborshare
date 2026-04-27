// Supabase Edge Function — notify-new-listing
// Déclencheur : Database Webhook sur INSERT dans public.listings
//
// Envoie :
//   - Un email Resend à tous les utilisateurs avec email_notifications_enabled=true (sauf l'auteur)
//   - Une notification push FCM à tous les utilisateurs avec un token FCM (sauf l'auteur)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getFCMCredentials, sendFCMPush } from '../_shared/fcm.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM    = Deno.env.get('RESEND_FROM_EMAIL') ?? 'NeighborShare <notifications@neighborshare.fr>'
const APP_URL        = Deno.env.get('APP_URL') ?? 'https://neighborshare.fr'

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const listing = payload.record

    if (!listing?.id) {
      return new Response('No listing record', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const listingUrl = `${APP_URL}/listings/${listing.id}`
    const title      = listing.title ?? 'Nouvelle annonce'
    const authorId   = listing.user_id

    // ── 1. Emails ─────────────────────────────────────────────────────────────
    if (RESEND_API_KEY) {
      // Récupère tous les profils opt-in (sauf l'auteur)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('email_notifications_enabled', true)
        .neq('id', authorId)

      const userIds = (profiles ?? []).map(p => p.id)

      if (userIds.length > 0) {
        // Récupère les emails depuis auth.users (nécessite service_role)
        const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
        const emailMap = new Map(users.map(u => [u.id, u.email]))

        const emailPromises = userIds
          .map(id => emailMap.get(id))
          .filter((email): email is string => Boolean(email))
          .map(email =>
            fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: RESEND_FROM,
                to: [email],
                subject: `Nouvelle annonce : ${title}`,
                html: buildListingEmailHtml(title, listing.description, listing.city, listingUrl),
              }),
            })
          )

        await Promise.allSettled(emailPromises)
      }
    } else {
      console.warn('[notify-new-listing] RESEND_API_KEY not set — emails skipped')
    }

    // ── 2. Push FCM ────────────────────────────────────────────────────────────
    const fcm = await getFCMCredentials()
    if (fcm) {
      // Récupère tous les tokens des utilisateurs push-enabled (sauf l'auteur)
      const { data: rows } = await supabase
        .from('fcm_tokens')
        .select('token, user_id')
        .neq('user_id', authorId)

      // Filtre sur push_notifications_enabled=true
      const { data: pushProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('push_notifications_enabled', true)
        .neq('id', authorId)

      const enabledIds = new Set((pushProfiles ?? []).map(p => p.id))
      const tokens = (rows ?? [])
        .filter(r => enabledIds.has(r.user_id))
        .map(r => r.token)

      await Promise.allSettled(
        tokens.map(token =>
          sendFCMPush(
            token,
            { title: '🆕 Nouvelle annonce', body: title, url: listingUrl },
            fcm.accessToken,
            fcm.projectId,
          )
        )
      )
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    console.error('[notify-new-listing]', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

function buildListingEmailHtml(title: string, description: string | null, city: string | null, url: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;padding:32px;">
    <h1 style="color:#16a34a;font-size:20px;margin-bottom:8px;">🌿 NeighborShare</h1>
    <h2 style="font-size:17px;color:#111827;margin-bottom:12px;">Nouvelle annonce publiée</h2>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:20px;">
      <p style="font-weight:600;color:#111827;margin:0 0 4px;">${title}</p>
      ${city ? `<p style="color:#6b7280;font-size:13px;margin:0 0 8px;">📍 ${city}</p>` : ''}
      ${description ? `<p style="color:#374151;font-size:14px;margin:0;">${description.slice(0, 200)}${description.length > 200 ? '…' : ''}</p>` : ''}
    </div>
    <a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Voir l'annonce →</a>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      Vous recevez cet email car vous êtes inscrit sur NeighborShare.<br>
      Vous pouvez désactiver ces notifications dans votre <a href="${APP_URL}/profile" style="color:#16a34a;">profil</a>.
    </p>
  </div>
</body>
</html>`
}
