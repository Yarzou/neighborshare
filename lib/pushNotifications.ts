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
