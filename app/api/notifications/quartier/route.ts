import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendPushToAll, sendPushToUsers } from '@/lib/fcm-admin'

/**
 * Notifications push « vie du quartier » — push uniquement, jamais d'email
 * (le canal SMTP Gmail est plafonné, pas FCM).
 *
 * Appelée fire-and-forget par le client après un insert réussi (même pattern
 * que /api/notifications pour les demandes). Chaque événement re-vérifie côté
 * serveur que l'appelant est bien lié au contenu : impossible de spammer le
 * quartier en postant des ids arbitraires.
 *
 * Événements :
 *   new_announcement    → tout le quartier (sauf l'auteur)      · id = announcements.id
 *   new_poll            → tout le quartier (sauf l'auteur)      · id = polls.id
 *   new_event           → tout le quartier (sauf l'auteur)      · id = events.id
 *   new_group_purchase  → tout le quartier (sauf l'auteur)      · id = group_purchases.id
 *   gp_participation    → créateur de l'achat                   · id = group_purchases.id
 *   gp_target_reached   → créateur + participants (sauf acteur) · id = group_purchases.id
 */

type QuartierEvent =
  | 'new_announcement'
  | 'new_poll'
  | 'new_event'
  | 'new_group_purchase'
  | 'gp_participation'
  | 'gp_target_reached'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const { event, id } = (body ?? {}) as { event?: QuartierEvent; id?: string }

  if (!event || !id) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  switch (event) {
    case 'new_announcement': {
      const { data } = await admin
        .from('announcements')
        .select('title, author_id')
        .eq('id', id)
        .single()
      if (!data || data.author_id !== user.id) break

      await sendPushToAll(user.id, {
        title: '📢 Info du lotissement',
        body: data.title,
        url: `${APP_URL}/infos`,
      })
      break
    }

    case 'new_poll': {
      const { data } = await admin
        .from('polls')
        .select('question, created_by')
        .eq('id', id)
        .single()
      if (!data || data.created_by !== user.id) break

      await sendPushToAll(user.id, {
        title: '🗳️ Nouveau sondage',
        body: data.question,
        url: `${APP_URL}/infos`,
      })
      break
    }

    case 'new_event': {
      const { data } = await admin
        .from('events')
        .select('title, user_id, event_date')
        .eq('id', id)
        .single()
      if (!data || data.user_id !== user.id) break

      const dateStr = new Date(data.event_date).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long',
      })
      await sendPushToAll(user.id, {
        title: '📅 Nouvel événement',
        body: `${data.title} — ${dateStr}`,
        url: `${APP_URL}/evenements/${id}`,
      })
      break
    }

    case 'new_group_purchase': {
      const { data } = await admin
        .from('group_purchases')
        .select('title, created_by')
        .eq('id', id)
        .single()
      if (!data || data.created_by !== user.id) break

      await sendPushToAll(user.id, {
        title: '🛒 Nouvel achat groupé',
        body: data.title,
        url: `${APP_URL}/achats`,
      })
      break
    }

    case 'gp_participation': {
      // L'appelant doit être un participant réel ; on notifie le créateur (sauf s'il participe à son propre achat)
      const [{ data: purchase }, { data: myPart }, { data: me }] = await Promise.all([
        admin.from('group_purchases').select('title, unit, created_by').eq('id', id).single(),
        admin.from('group_purchase_participants').select('quantity').eq('purchase_id', id).eq('user_id', user.id).single(),
        admin.from('profiles').select('full_name, username').eq('id', user.id).single(),
      ])
      if (!purchase || !myPart || purchase.created_by === user.id) break

      const who = me?.full_name || me?.username || 'Un voisin'
      await sendPushToUsers([purchase.created_by], {
        title: '🤝 Nouvelle participation',
        body: `${who} participe (${Number(myPart.quantity)} ${purchase.unit}) — « ${purchase.title} »`,
        url: `${APP_URL}/achats`,
      })
      break
    }

    case 'gp_target_reached': {
      // On ne fait pas confiance au client : le total est recalculé ici
      const [{ data: purchase }, { data: parts }] = await Promise.all([
        admin.from('group_purchases').select('title, unit, target_quantity, created_by').eq('id', id).single(),
        admin.from('group_purchase_participants').select('user_id, quantity').eq('purchase_id', id),
      ])
      if (!purchase || purchase.target_quantity == null || !parts) break

      const total = parts.reduce((sum: number, p: { quantity: number }) => sum + Number(p.quantity), 0)
      if (total < Number(purchase.target_quantity)) break

      // L'acteur doit être impliqué (participant ou créateur)
      const involved = parts.some((p: { user_id: string }) => p.user_id === user.id) || purchase.created_by === user.id
      if (!involved) break

      const recipients = Array.from(new Set([
        purchase.created_by,
        ...parts.map((p: { user_id: string }) => p.user_id),
      ])).filter(uid => uid !== user.id)

      await sendPushToUsers(recipients, {
        title: '🎯 Objectif atteint !',
        body: `« ${purchase.title} » : ${total} ${purchase.unit} réunis — l'objectif est atteint.`,
        url: `${APP_URL}/achats`,
      })
      break
    }

    default:
      return NextResponse.json({ error: 'Événement inconnu' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
