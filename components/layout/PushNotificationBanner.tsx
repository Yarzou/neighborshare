'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bell, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isPushSupported, activatePushNotifications } from '@/lib/pushNotifications'
import { cn } from '@/lib/utils'

const DISMISSED_KEY = (userId: string) => `push_prompt_dismissed_until:${userId}`
const DISMISS_DAYS = 30

export default function PushNotificationBanner() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOnMessages = pathname?.startsWith('/messages')

  useEffect(() => {
    if (!isOnMessages) return
    if (!isPushSupported()) return
    if (Notification.permission !== 'default') return

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      const until = localStorage.getItem(DISMISSED_KEY(user.id))
      if (until && Date.now() < Number(until)) return

      setUserId(user.id)
      const timer = setTimeout(() => setVisible(true), 3000)
      return () => clearTimeout(timer)
    })
  }, [isOnMessages])

  const handleActivate = async () => {
    if (!userId) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      await activatePushNotifications(userId, supabase)
      setVisible(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'activation.'
      if (Notification.permission === 'denied') {
        // Snooze court — l'utilisateur doit modifier les réglages du navigateur
        dismiss(1)
      }
      setError(msg)
      setSaving(false)
    }
  }

  const dismiss = (days = DISMISS_DAYS) => {
    if (userId) {
      const until = Date.now() + days * 24 * 60 * 60 * 1000
      localStorage.setItem(DISMISSED_KEY(userId), String(until))
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1200] flex justify-center px-4 pb-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Activer les notifications</p>
            <p className="text-xs text-gray-500">Soyez alerté des nouveaux messages et annonces</p>
          </div>
          <button
            onClick={() => dismiss()}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pb-4 flex flex-col gap-2">
          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
          <button
            onClick={handleActivate}
            disabled={saving}
            className={cn(
              'w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white text-sm font-semibold py-3 rounded-xl transition-colors',
              saving && 'opacity-50 cursor-not-allowed',
            )}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
            Activer les notifications
          </button>
          <button
            onClick={() => dismiss()}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-1.5 transition-colors"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  )
}
