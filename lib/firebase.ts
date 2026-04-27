import { initializeApp, getApps, getApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

let messaging: Messaging | null = null

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null
  if (!messaging) messaging = getMessaging(app)
  return messaging
}

/**
 * Enregistre le service worker FCM et attend qu'il soit actif.
 * Idempotent : si le SW est déjà enregistré et actif, retourne directement.
 */
export async function registerFirebaseSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    // SW servi par l'API route Next.js (config Firebase injectée côté serveur, pas de query string)
    const swUrl = '/api/firebase-messaging-sw'

    // Vérifie si un SW est déjà actif sur ce scope
    const existing = await navigator.serviceWorker.getRegistration('/')
    if (existing?.active) return existing

    const reg = await navigator.serviceWorker.register(swUrl, { scope: '/' })
    // Attend l'activation si nécessaire
    await waitForSWActive(reg)
    return reg
  } catch (err) {
    console.error('[FCM] SW registration failed:', err)
    return null
  }
}

function waitForSWActive(reg: ServiceWorkerRegistration): Promise<void> {
  if (reg.active) return Promise.resolve()
  return new Promise((resolve) => {
    const sw = reg.installing ?? reg.waiting
    if (!sw) { resolve(); return }
    sw.addEventListener('statechange', function handler() {
      if (sw.state === 'activated') {
        sw.removeEventListener('statechange', handler)
        resolve()
      }
    })
  })
}

/**
 * Demande la permission push et retourne le token FCM de l'appareil.
 * Lève une erreur descriptive en cas d'échec pour que l'UI puisse l'afficher.
 */
export async function requestFCMToken(): Promise<string> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    throw new Error('Les notifications push ne sont pas supportées sur ce navigateur.')
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    throw new Error('Configuration Firebase incomplète : NEXT_PUBLIC_FIREBASE_VAPID_KEY manquante.')
  }

  // Vérifie que les valeurs Firebase essentielles sont renseignées
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new Error('Configuration Firebase incomplète : renseignez les variables NEXT_PUBLIC_FIREBASE_* dans .env.local.')
  }

  const permission = await Notification.requestPermission()
  if (permission === 'denied') {
    throw new Error('Permission refusée. Autorisez les notifications dans les réglages de votre navigateur.')
  }
  if (permission !== 'granted') {
    throw new Error('Permission non accordée.')
  }

  const m = getFirebaseMessaging()
  if (!m) {
    throw new Error('Firebase Messaging non disponible.')
  }

  // S'assure que le SW est enregistré et actif avant d'appeler getToken
  const swReg = await registerFirebaseSW()
  if (!swReg) {
    throw new Error('Le service worker n\'a pas pu être enregistré.')
  }

  try {
    const token = await getToken(m, { vapidKey, serviceWorkerRegistration: swReg })
    if (!token) {
      throw new Error('Impossible d\'obtenir le token FCM. Vérifiez la configuration Firebase.')
    }
    return token
  } catch (err) {
    // Retransmet l'erreur Firebase avec son message original pour faciliter le diagnostic
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Erreur FCM : ${msg}`)
  }
}

export { onMessage, getToken }
