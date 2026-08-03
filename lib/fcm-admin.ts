import { createClient } from '@supabase/supabase-js'

let appInitialized = false

function getAdminApp() {
  if (appInitialized) return
  const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) return

  // Lazy import to avoid bundling firebase-admin in the client
  const admin = require('firebase-admin')
  if (admin.apps.length === 0) {
    const serviceAccount = JSON.parse(
      Buffer.isBuffer(serviceAccountJson)
        ? serviceAccountJson.toString()
        : serviceAccountJson.startsWith('{')
          ? serviceAccountJson
          : Buffer.from(serviceAccountJson, 'base64').toString('utf-8')
    )
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
  appInitialized = true
}

interface PushNotification {
  title: string
  body: string
  url?: string
}

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Envoi bas niveau vers une liste de tokens : multicast par lots de 500
 * (limite FCM) + suppression automatique des tokens invalides/expirés.
 */
async function sendToTokens(tokens: string[], notification: PushNotification): Promise<void> {
  if (tokens.length === 0) return
  getAdminApp()
  const admin = require('firebase-admin')
  const messaging = admin.messaging()
  const adminSupabase = getAdminSupabase()

  const invalidTokens: string[] = []
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500)
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      webpush: notification.url
        ? { fcmOptions: { link: notification.url } }
        : undefined,
    })

    response.responses.forEach(
      (resp: { success: boolean; error?: { code: string } }, idx: number) => {
        if (
          !resp.success &&
          resp.error?.code &&
          [
            'messaging/invalid-registration-token',
            'messaging/registration-token-not-registered',
          ].includes(resp.error.code)
        ) {
          invalidTokens.push(chunk[idx])
        }
      }
    )
  }

  if (invalidTokens.length > 0) {
    await adminSupabase.from('fcm_tokens').delete().in('token', invalidTokens)
  }
}

/**
 * Sends a push notification to all FCM tokens registered for a user.
 * Silently no-ops if FCM_SERVICE_ACCOUNT_JSON is not configured.
 * ⚠️ Ne vérifie PAS `push_notifications_enabled` — c'est à l'appelant de le
 * faire (comportement historique de /api/notifications). Les helpers
 * `sendPushToUsers` / `sendPushToAll` le vérifient, eux.
 */
export async function sendPushToUser(
  userId: string,
  notification: PushNotification
): Promise<void> {
  if (!process.env.FCM_SERVICE_ACCOUNT_JSON) return

  try {
    const { data: rows } = await getAdminSupabase()
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', userId)

    await sendToTokens((rows ?? []).map((r: { token: string }) => r.token), notification)
  } catch (err) {
    console.error('[FCM Admin] Error sending push:', err)
  }
}

/**
 * Push vers un ensemble d'utilisateurs, en respectant leur préférence
 * `push_notifications_enabled` (null = activé, comme les Edge Functions).
 */
export async function sendPushToUsers(
  userIds: string[],
  notification: PushNotification
): Promise<void> {
  if (!process.env.FCM_SERVICE_ACCOUNT_JSON || userIds.length === 0) return

  try {
    const adminSupabase = getAdminSupabase()

    const { data: profiles } = await adminSupabase
      .from('profiles')
      .select('id, push_notifications_enabled')
      .in('id', userIds)

    const enabledIds = (profiles ?? [])
      .filter((p: { push_notifications_enabled: boolean | null }) => p.push_notifications_enabled !== false)
      .map((p: { id: string }) => p.id)
    if (enabledIds.length === 0) return

    const { data: rows } = await adminSupabase
      .from('fcm_tokens')
      .select('token')
      .in('user_id', enabledIds)

    await sendToTokens((rows ?? []).map((r: { token: string }) => r.token), notification)
  } catch (err) {
    console.error('[FCM Admin] Error sending push to users:', err)
  }
}

/**
 * Push à tout le quartier, sauf l'auteur de l'action.
 * Utilisé par /api/notifications/quartier (infos ASL, sondages, événements,
 * achats groupés). Push uniquement — volontairement aucun email : le canal
 * SMTP Gmail est plafonné (~500 destinataires/jour), pas FCM.
 */
export async function sendPushToAll(
  excludeUserId: string,
  notification: PushNotification
): Promise<void> {
  if (!process.env.FCM_SERVICE_ACCOUNT_JSON) return

  try {
    const { data: profiles } = await getAdminSupabase()
      .from('profiles')
      .select('id')
      .neq('id', excludeUserId)

    await sendPushToUsers((profiles ?? []).map((p: { id: string }) => p.id), notification)
  } catch (err) {
    console.error('[FCM Admin] Error sending broadcast push:', err)
  }
}
