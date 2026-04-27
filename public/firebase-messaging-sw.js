// Service Worker Firebase Messaging — gère les notifications push en arrière-plan.
// La config Firebase est passée via query string (?firebaseConfig=<base64>)
// lors de l'enregistrement du SW (voir lib/firebase.ts > registerFirebaseSW).

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

const params = new URLSearchParams(self.location.search)
const configParam = params.get('firebaseConfig')

if (configParam && !firebase.apps.length) {
  try {
    const config = JSON.parse(atob(configParam))
    firebase.initializeApp(config)

    const messaging = firebase.messaging()

    messaging.onBackgroundMessage((payload) => {
      const { title, body, icon } = payload.notification ?? {}
      self.registration.showNotification(title ?? 'Les voisins du Cèdre', {
        body: body ?? '',
        icon: icon ?? '/logo_cedre.png',
        badge: '/logo_cedre.png',
        data: payload.data,
      })
    })
  } catch (err) {
    console.error('[FCM SW] Failed to initialize Firebase:', err)
  }
}

// Clic sur une notification : ouvre l'app sur l'URL cible si fournie
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/'
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

