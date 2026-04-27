/**
 * Utilitaires partagés pour l'envoi de notifications push via Firebase Cloud Messaging (HTTP v1).
 * Utilise un Service Account Google pour générer un token OAuth2.
 */

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

/** Génère un token OAuth2 Google à partir d'un Service Account JSON. */
async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const toBase64Url = (s: string) =>
    btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const header  = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  }))

  const signingInput = `${header}.${payload}`

  // Import clé privée PEM → CryptoKey
  const pemBody = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  const sig = toBase64Url(String.fromCharCode(...new Uint8Array(sigBytes)))
  const jwt = `${signingInput}.${sig}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    throw new Error(`[FCM] OAuth2 token error: ${JSON.stringify(tokenData)}`)
  }
  return tokenData.access_token
}

interface FCMNotification {
  title: string
  body: string
  url?: string
}

/** Envoie une notification FCM à un token d'appareil. Retourne true si succès. */
export async function sendFCMPush(
  deviceToken: string,
  notification: FCMNotification,
  accessToken: string,
  projectId: string,
): Promise<boolean> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title: notification.title, body: notification.body },
          webpush: {
            notification: { icon: '/logo_cedre.png' },
            fcm_options: { link: notification.url ?? '/' },
          },
        },
      }),
    },
  )
  if (!res.ok) {
    const err = await res.text()
    console.error(`[FCM] Push failed for token ${deviceToken.slice(0, 20)}…: ${err}`)
  }
  return res.ok
}

/** Charge les credentials FCM depuis les variables d'environnement et retourne le token OAuth2. */
export async function getFCMCredentials(): Promise<{ accessToken: string; projectId: string } | null> {
  const saJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  if (!saJson) {
    console.warn('[FCM] FCM_SERVICE_ACCOUNT_JSON is not set — push notifications disabled')
    return null
  }
  const sa: ServiceAccount = JSON.parse(saJson)
  const accessToken = await getGoogleAccessToken(sa)
  return { accessToken, projectId: sa.project_id }
}
