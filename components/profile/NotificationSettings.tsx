'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isPushSupported, activatePushNotifications, deactivatePushNotifications } from '@/lib/pushNotifications'
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
    setPushSupported(isPushSupported())
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
      try {
        await activatePushNotifications(userId, supabase)
        setPushEnabled(true)
      } catch (err) {
        setPushError(err instanceof Error ? err.message : 'Erreur lors de l\'activation des notifications push.')
        setPushSaving(false)
        return
      }
    } else {
      try {
        await deactivatePushNotifications(userId, supabase)
      } catch {
        // Continue même en cas d'erreur
      }
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
