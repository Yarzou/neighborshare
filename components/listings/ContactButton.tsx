'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Loader2, CheckCircle } from 'lucide-react'
import type { ListingStatus } from '@/lib/types'

interface Props {
  listingId: string
  receiverId: string
  listingStatus: ListingStatus
}

export function ContactButton({ listingId, receiverId, listingStatus }: Props) {
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  if (listingStatus !== 'disponible') {
    return (
      <div className="w-full py-3 text-center bg-gray-50 text-gray-400 rounded-xl text-sm font-medium border border-gray-200">
        {listingStatus === 'en_cours' ? '⏳ Une demande est en cours' : '✅ Annonce validée'}
      </div>
    )
  }

  const handleSend = async () => {
    if (!message.trim()) return
    setLoading(true)
    setError(null)

    const { data: convId, error: rpcError } = await supabase.rpc('contact_listing', {
      p_listing_id: listingId,
      p_first_message: message.trim(),
    })

    if (rpcError) {
      setError(rpcError.message || 'Erreur lors de l\'envoi. Réessayez.')
      setLoading(false)
      return
    }

    router.push(`/messages/${convId}`)
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
          {error && (
            <p className="text-xs text-red-500 px-1">{error}</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setOpen(false); setError(null) }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button onClick={handleSend} disabled={loading || !message.trim()}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
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
