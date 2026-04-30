import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendPushToUser } from '@/lib/fcm-admin'
import {
  sendNewRequestEmail,
  sendAcceptedEmail,
  sendRefusedEmail,
  sendCancelledEmail,
} from '@/lib/email-notifications'

type NotificationEvent = 'new_request' | 'accepted' | 'refused' | 'cancelled'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()

  // Auth check via session cookie
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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const { listingId, event } = body ?? {}

  if (!listingId || !event) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // Use service role to fetch listing + profiles (bypasses RLS)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: listing } = await admin
    .from('listings')
    .select('id, title, user_id, responder_id')
    .eq('id', listingId)
    .single()

  if (!listing) {
    return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 })
  }

  // Determine target user based on event
  let targetUserId: string | null = null
  if (event === 'new_request' || event === 'cancelled') {
    targetUserId = listing.user_id
  } else if (event === 'accepted' || event === 'refused') {
    targetUserId = listing.responder_id
  }

  if (!targetUserId) {
    return NextResponse.json({ ok: true })
  }

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('full_name, email_notifications_enabled, push_notifications_enabled')
    .eq('id', targetUserId)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ ok: true })
  }

  // Fetch target user email from auth.users via admin
  const { data: authUser } = await admin.auth.admin.getUserById(targetUserId)
  const targetEmail = authUser?.user?.email ?? null

  const listingTitle = listing.title as string
  const targetName = (targetProfile.full_name as string) || 'Voisin'
  const listingId_ = listing.id as string

  // Send push notification
  if (targetProfile.push_notifications_enabled) {
    const messages: Record<NotificationEvent, { title: string; body: string }> = {
      new_request: {
        title: '🎉 Nouvelle demande de prêt',
        body: `Quelqu'un est intéressé par votre annonce « ${listingTitle} »`,
      },
      accepted: {
        title: '✅ Demande acceptée',
        body: `Votre demande pour « ${listingTitle} » a été acceptée !`,
      },
      refused: {
        title: 'Demande non retenue',
        body: `Votre demande pour « ${listingTitle} » n'a pas pu être accordée.`,
      },
      cancelled: {
        title: 'Demande annulée',
        body: `La demande pour votre annonce « ${listingTitle} » a été annulée.`,
      },
    }

    const msg = messages[event as NotificationEvent]
    if (msg) {
      await sendPushToUser(targetUserId, {
        ...msg,
        url: `${process.env.NEXT_PUBLIC_APP_URL}/listings/${listingId_}`,
      })
    }
  }

  // Send email notification
  if (targetProfile.email_notifications_enabled && targetEmail) {
    if (event === 'new_request') {
      await sendNewRequestEmail(targetEmail, targetName, listingTitle, listingId_)
    } else if (event === 'accepted') {
      await sendAcceptedEmail(targetEmail, targetName, listingTitle, listingId_)
    } else if (event === 'refused') {
      await sendRefusedEmail(targetEmail, targetName, listingTitle, listingId_)
    } else if (event === 'cancelled') {
      await sendCancelledEmail(targetEmail, targetName, listingTitle, listingId_)
    }
  }

  return NextResponse.json({ ok: true })
}
