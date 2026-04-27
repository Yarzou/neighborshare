import { initializeApp, getApps, getApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET!,
  measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID!,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

let messaging: Messaging | null = null

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null
  if (!messaging) messaging = getMessaging(app)
  return messaging
}

/**
 * Enregistre le service worker FCM en lui passant la config Firebase via query string.
 * Doit être appelé une fois au chargement de l'app.
 */
export async function registerFirebaseSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const configParam = btoa(JSON.stringify(firebaseConfig))
    const reg = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?firebaseConfig=${configParam}`,
      { scope: '/' },
    )
    return reg
  } catch (err) {
    console.error('[FCM] SW registration failed:', err)
    return null
  }
}

/**
 * Demande la permission push et retourne le token FCM de l'appareil.
 * Retourne null si la permission est refusée ou si le navigateur ne supporte pas les push.
 */
export async function requestFCMToken(): Promise<string | null> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    console.warn('[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set')
    return null
  }

  const m = getFirebaseMessaging()
  if (!m) return null

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const swReg = await navigator.serviceWorker.getRegistration('/')
    const token = await getToken(m, { vapidKey, serviceWorkerRegistration: swReg })
    return token ?? null
  } catch (err) {
    console.error('[FCM] Failed to get token:', err)
    return null
  }
}

export { onMessage, getToken }
