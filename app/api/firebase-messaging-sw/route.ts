import { NextResponse } from 'next/server'

/**
 * Sert le Service Worker Firebase Messaging avec la config Firebase injectée.
 * L'en-tête "Service-Worker-Allowed: /" permet au SW servi depuis /api/
 * de contrôler toutes les pages du site.
 */
export async function GET() {
  const config = JSON.stringify({
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  })

  const script = `
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

if (!firebase.apps.length) {
  firebase.initializeApp(${config})
}

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const data = payload.data ?? {}
  const title = data.title ?? 'Les voisins du Cèdre'
  const body  = data.body  ?? ''
  const icon  = data.icon  ?? '/logo_cedre.png'
  const url   = data.url   ?? '/'
  self.registration.showNotification(title, {
    body,
    icon,
    badge: '/logo_cedre.png',
    data: { url },
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      return clients.openWindow(targetUrl)
    })
  )
})
`

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
