import type { SupabaseClient } from '@supabase/supabase-js'
import { requestFCMToken } from '@/lib/firebase'

/** Vérifie si le navigateur supporte les notifications push. */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

/**
 * Demande la permission, récupère le token FCM et l'enregistre en base.
 * Utilisé par NotificationSettings et PushNotificationBanner.
 * Lève une erreur descriptive en cas d'échec.
 */
export async function activatePushNotifications(
  userId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const token = await requestFCMToken()
  const { error } = await supabase
    .from('fcm_tokens')
    .upsert({ user_id: userId, token }, { onConflict: 'token' })
  if (error) throw new Error('Erreur lors de l\'enregistrement du token.')
  await supabase
    .from('profiles')
    .update({ push_notifications_enabled: true })
    .eq('id', userId)
}

/**
 * Supprime le token FCM de l'appareil courant et désactive les push en profil.
 */
export async function deactivatePushNotifications(
  userId: string,
  supabase: SupabaseClient,
): Promise<void> {
  try {
    const { getFirebaseMessaging, registerFirebaseSW, getToken } = await import('@/lib/firebase')
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    const m = getFirebaseMessaging()
    if (m && vapidKey) {
      const swReg = await registerFirebaseSW()
      if (swReg) {
        const token = await getToken(m, { vapidKey, serviceWorkerRegistration: swReg })
        if (token) {
          await supabase.from('fcm_tokens').delete().eq('token', token).eq('user_id', userId)
        }
      }
    }
  } catch {
    // Continue même sans token
  }
  await supabase.from('profiles').update({ push_notifications_enabled: false }).eq('id', userId)
}

/** Événements gérés par POST /api/notifications/quartier */
export type QuartierNotificationEvent =
  | 'new_announcement'
  | 'new_poll'
  | 'new_event'
  | 'new_group_purchase'
  | 'new_provider'
  | 'gp_participation'
  | 'gp_target_reached'

/**
 * Déclenche une notification push « vie du quartier », en fire-and-forget :
 * ne bloque jamais le flux métier, échoue en silence (intégrations dégradables).
 * La route re-vérifie côté serveur que l'appelant est bien lié au contenu.
 */
export function notifyQuartier(event: QuartierNotificationEvent, id: string): void {
  fetch('/api/notifications/quartier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, id }),
  }).catch(() => {})
}
