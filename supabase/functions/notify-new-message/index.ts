// Supabase Edge Function — notify-new-message
// Déclencheur : Database Webhook sur INSERT dans public.messages
//
// Envoie :
//   - Un email Resend aux participants de la conversation (sauf l'expéditeur)
//     si email_notifications_enabled=true
//   - Une notification push FCM aux participants (sauf l'expéditeur)
//     si push_notifications_enabled=true et token FCM présent

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM    = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Les voisins du Cèdre <notifications@voisinsducedre.fr>'
const APP_URL        = Deno.env.get('APP_URL') ?? 'https://voisinsducedre.fr'

// ── FCM utilities (inlined) ────────────────────────────────────────────────────

interface ServiceAccount { client_email: string; private_key: string; project_id: string }

async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const toB64u = (s: string) => btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const header  = toB64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toB64u(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now,
  }))
  const sigInput  = `${header}.${payload}`
  const pemBody   = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const keyData   = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey('pkcs8', keyData.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sigBytes  = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput))
  const sig       = toB64u(String.fromCharCode(...new Uint8Array(sigBytes)))
  const tokenRes  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${sigInput}.${sig}` }),
  })
  const data = await tokenRes.json()
  if (!data.access_token) throw new Error(`[FCM] OAuth2 error: ${JSON.stringify(data)}`)
  return data.access_token
}

async function sendFCMPush(token: string, notification: { title: string; body: string; url?: string }, accessToken: string, projectId: string): Promise<boolean> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: {
      token, notification: { title: notification.title, body: notification.body },
      webpush: { notification: { icon: '/logo_cedre.png' }, fcm_options: { link: notification.url ?? '/' } },
    }}),
  })
  if (!res.ok) console.error(`[FCM] Push failed: ${await res.text()}`)
  return res.ok
}

async function getFCMCredentials(): Promise<{ accessToken: string; projectId: string } | null> {
  const saJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  if (!saJson) { console.warn('[FCM] FCM_SERVICE_ACCOUNT_JSON not set'); return null }
  const sa: ServiceAccount = JSON.parse(saJson)
  return { accessToken: await getGoogleAccessToken(sa), projectId: sa.project_id }
}

// ── Handler ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const message = payload.record

    if (!message?.id || !message?.conversation_id || !message?.sender_id) {
      return new Response('Invalid message record', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const senderId        = message.sender_id
    const conversationId  = message.conversation_id
    const messagePreview  = (message.content ?? '').slice(0, 120)
    const convUrl         = `${APP_URL}/messages/${conversationId}`

    // Récupère tous les participants (sauf l'expéditeur) avec leur profil
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id, profiles(full_name, username, email_notifications_enabled, push_notifications_enabled)')
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId)

    if (!participants || participants.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no recipients' }), { status: 200 })
    }

    // Récupère le nom de l'expéditeur pour personnaliser les notifications
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', senderId)
      .single()

    const senderName = senderProfile?.full_name || senderProfile?.username || 'Un voisin'
    const recipientIds = participants.map(p => p.user_id)

    // ── 1. Emails ─────────────────────────────────────────────────────────────
    if (RESEND_API_KEY) {
      // Récupère les emails depuis auth.users
      const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const emailMap = new Map(users.map(u => [u.id, u.email]))

      const emailRecipients = participants
        .filter(p => {
          const profile = p.profiles as { email_notifications_enabled?: boolean } | null
          return profile?.email_notifications_enabled !== false
        })
        .map(p => emailMap.get(p.user_id))
        .filter((email): email is string => Boolean(email))

      await Promise.allSettled(
        emailRecipients.map(email =>
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: RESEND_FROM,
              to: [email],
              subject: `Nouveau message de ${senderName}`,
              html: buildMessageEmailHtml(senderName, messagePreview, convUrl),
            }),
          })
        )
      )
    } else {
      console.warn('[notify-new-message] RESEND_API_KEY not set — emails skipped')
    }

    // ── 2. Push FCM ────────────────────────────────────────────────────────────
    const fcm = await getFCMCredentials()
    if (fcm && recipientIds.length > 0) {
      // Récupère les tokens des destinataires push-enabled
      const pushEnabledIds = participants
        .filter(p => {
          const profile = p.profiles as { push_notifications_enabled?: boolean } | null
          return profile?.push_notifications_enabled !== false
        })
        .map(p => p.user_id)

      if (pushEnabledIds.length > 0) {
        const { data: tokenRows } = await supabase
          .from('fcm_tokens')
          .select('token')
          .in('user_id', pushEnabledIds)

        await Promise.allSettled(
          (tokenRows ?? []).map(r =>
            sendFCMPush(
              r.token,
              { title: `💬 ${senderName}`, body: messagePreview, url: convUrl },
              fcm.accessToken,
              fcm.projectId,
            )
          )
        )
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    console.error('[notify-new-message]', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

function buildMessageEmailHtml(senderName: string, preview: string, url: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:sans-serif;background:#f9fafb;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;padding:32px;">
    <h1 style="color:#16a34a;font-size:20px;margin-bottom:8px;">🌿 Les voisins du Cèdre</h1>
    <h2 style="font-size:17px;color:#111827;margin-bottom:12px;">Vous avez un nouveau message</h2>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:20px;">
      <p style="font-weight:600;color:#111827;margin:0 0 8px;">${senderName}</p>
      <p style="color:#374151;font-size:14px;margin:0;">${preview}${preview.length >= 120 ? '…' : ''}</p>
    </div>
    <a href="${url}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Répondre →</a>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
      Vous recevez cet email car vous êtes inscrit sur Les voisins du Cèdre.<br>
      Vous pouvez désactiver ces notifications dans votre <a href="${APP_URL}/profile" style="color:#16a34a;">profil</a>.
    </p>
  </div>
</body>
</html>`
}
