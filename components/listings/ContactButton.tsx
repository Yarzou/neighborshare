'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Loader2 } from 'lucide-react'

interface Props {
  listingId: string
  receiverId: string
}

export function ContactButton({ listingId, receiverId }: Props) {
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSend = async () => {
    if (!message.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/auth/login')

    await supabase.from('messages').insert({
      listing_id: listingId,
      sender_id: user.id,
      receiver_id: receiverId,
      content: message.trim(),
    })
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="w-full py-3 text-center bg-green-50 text-green-700 rounded-xl text-sm font-medium">
        ✓ Message envoyé !
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {open ? (
        <>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            placeholder="Bonjour, je suis intéressé(e) par votre annonce..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm resize-none"
          />
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button onClick={handleSend} disabled={loading || !message.trim()}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Envoyer
            </button>
          </div>
        </>
      ) : (
        <button onClick={() => setOpen(true)}
          className="w-full py-3 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 transition-colors text-sm flex items-center justify-center gap-2">
          <MessageCircle size={16} /> Contacter
        </button>
      )}
    </div>
  )
}
