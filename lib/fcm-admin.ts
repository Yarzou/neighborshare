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

/**
 * Sends a push notification to all FCM tokens registered for a user.
 * Silently no-ops if FCM_SERVICE_ACCOUNT_JSON is not configured.
 * Automatically removes invalid/expired tokens.
 */
export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string; url?: string }
): Promise<void> {
  if (!process.env.FCM_SERVICE_ACCOUNT_JSON) return

  try {
    getAdminApp()
    const admin = require('firebase-admin')

    // Fetch tokens using service role (bypasses RLS)
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: rows } = await adminSupabase
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', userId)

    if (!rows || rows.length === 0) return

    const tokens = rows.map((r: { token: string }) => r.token)
    const messaging = admin.messaging()

    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      webpush: notification.url
        ? { fcmOptions: { link: notification.url } }
        : undefined,
    })

    // Remove tokens that FCM rejected as invalid
    const invalidTokens: string[] = []
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
          invalidTokens.push(tokens[idx])
        }
      }
    )

    if (invalidTokens.length > 0) {
      await adminSupabase
        .from('fcm_tokens')
        .delete()
        .in('token', invalidTokens)
    }
  } catch (err) {
    console.error('[FCM Admin] Error sending push:', err)
  }
}
