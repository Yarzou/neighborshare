'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { requestFCMToken } from '@/lib/firebase'
import { Bell, Mail, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  userId: string
  initialEmailEnabled: boolean
  initialPushEnabled: boolean
}

export default function NotificationSettings({ userId, initialEmailEnabled, initialPushEnabled }: Props) {
  const supabase = createClient()

  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled)
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled)
  const [emailSaving, setEmailSaving] = useState(false)
  const [pushSaving, setPushSaving] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushSupported, setPushSupported] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined' && !('Notification' in window)) {
      setPushSupported(false)
    }
  }, [])

  const handleEmailToggle = async (enabled: boolean) => {
    setEmailEnabled(enabled)
    setEmailSaving(true)
    await supabase.from('profiles').update({ email_notifications_enabled: enabled }).eq('id', userId)
    setEmailSaving(false)
  }

  const handlePushToggle = async (enabled: boolean) => {
    setPushError(null)
    setPushSaving(true)

    if (enabled) {
      let token: string
      try {
        token = await requestFCMToken()
      } catch (err) {
        setPushError(err instanceof Error ? err.message : 'Erreur lors de l\'activation des notifications push.')
        setPushSaving(false)
        return
      }
      // Upsert du token FCM pour cet utilisateur
      const { error } = await supabase.from('fcm_tokens').upsert({ user_id: userId, token }, { onConflict: 'token' })
      if (error) {
        setPushError('Erreur lors de l\'activation des notifications push.')
        setPushSaving(false)
        return
      }
      await supabase.from('profiles').update({ push_notifications_enabled: true }).eq('id', userId)
      setPushEnabled(true)
    } else {
      // Récupère le token actuel de l'appareil et le supprime
      try {
        const { getFirebaseMessaging, registerFirebaseSW, getToken: fcmGetToken } = await import('@/lib/firebase')
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
        const m = getFirebaseMessaging()
        if (m && vapidKey) {
          const swReg = await registerFirebaseSW()
          if (swReg) {
            const token = await fcmGetToken(m, { vapidKey, serviceWorkerRegistration: swReg })
            if (token) {
              await supabase.from('fcm_tokens').delete().eq('token', token).eq('user_id', userId)
            }
          }
        }
      } catch {
        // On continue même si on ne peut pas récupérer le token
      }
      await supabase.from('profiles').update({ push_notifications_enabled: false }).eq('id', userId)
      setPushEnabled(false)
    }

    setPushSaving(false)
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <Bell size={17} className="text-brand-600" />
        Notifications
      </h2>

      <div className="flex flex-col gap-4">
        {/* Toggle email */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Mail size={17} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Notifications par email</p>
              <p className="text-xs text-gray-400">Nouvelles annonces et nouveaux messages</p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={emailEnabled}
            disabled={emailSaving}
            onClick={() => handleEmailToggle(!emailEnabled)}
            className={cn(
              'relative inline-flex w-11 h-6 rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-400',
              emailEnabled ? 'bg-brand-600' : 'bg-gray-200',
              emailSaving && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className={cn(
              'inline-block w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5',
              emailEnabled ? 'translate-x-5' : 'translate-x-0.5',
            )} />
            {emailSaving && <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-white" />}
          </button>
        </div>

        {/* Toggle push */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Bell size={17} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Notifications push</p>
              <p className="text-xs text-gray-400">
                {pushSupported
                  ? 'Sur cet appareil (navigateur / PWA)'
                  : 'Non supporté sur ce navigateur'}
              </p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={pushEnabled}
            disabled={pushSaving || !pushSupported}
            onClick={() => handlePushToggle(!pushEnabled)}
            className={cn(
              'relative inline-flex w-11 h-6 rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-400',
              pushEnabled ? 'bg-brand-600' : 'bg-gray-200',
              (pushSaving || !pushSupported) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className={cn(
              'inline-block w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5',
              pushEnabled ? 'translate-x-5' : 'translate-x-0.5',
            )} />
            {pushSaving && <Loader2 size={10} className="absolute inset-0 m-auto animate-spin text-white" />}
          </button>
        </div>

        {pushError && (
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
            <AlertCircle size={13} /> {pushError}
          </div>
        )}
      </div>
    </div>
  )
}
