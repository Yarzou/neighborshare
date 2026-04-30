'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, MessageCircle, Loader2 } from 'lucide-react'
import type { ListingStatus } from '@/lib/types'

interface Props {
  listingId: string
  status: ListingStatus
  conversationId: string | null
  isOwner: boolean
  isResponder: boolean
}

export function ListingActions({ listingId, status, conversationId, isOwner, isResponder }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: string, rpc: string, event?: string) => {
    setLoading(action)
    setError(null)
    const { error: rpcError } = await supabase.rpc(rpc, { p_listing_id: listingId })
    if (rpcError) {
      setError(rpcError.message)
      setLoading(null)
      return
    }
    if (event) {
      fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, event }),
      }).catch(console.error)
    }
    router.refresh()
    setLoading(null)
  }

  // Aller vers la conversation liée
  const goToConversation = () => {
    if (conversationId) router.push(`/messages/${conversationId}`)
  }

  if (status === 'disponible') return null

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      {/* Accéder à la conversation */}
      {conversationId && (isOwner || isResponder) && (
        <button
          onClick={goToConversation}
          className="w-full py-2.5 rounded-xl bg-brand-50 text-brand-700 text-sm font-medium hover:bg-brand-100 transition-colors flex items-center justify-center gap-2 border border-brand-200"
        >
          <MessageCircle size={15} /> Voir la conversation
        </button>
      )}

      {/* Propriétaire : valider */}
      {isOwner && status === 'en_cours' && (
        <button
          onClick={() => run('validate', 'validate_listing_response', 'accepted')}
          disabled={loading !== null}
          className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading === 'validate' ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
          Valider la demande
        </button>
      )}

      {/* Propriétaire : annuler validation */}
      {isOwner && status === 'validee' && (
        <button
          onClick={() => run('cancel', 'cancel_listing_response')}
          disabled={loading !== null}
          className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading === 'cancel' ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
          Annuler la validation
        </button>
      )}

      {/* Propriétaire : annuler la demande en cours */}
      {isOwner && status === 'en_cours' && (
        <button
          onClick={() => run('cancel', 'cancel_listing_response', 'refused')}
          disabled={loading !== null}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading === 'cancel' ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
          Refuser la demande
        </button>
      )}

      {/* Répondant : annuler sa propre demande */}
      {isResponder && (status === 'en_cours' || status === 'validee') && (
        <button
          onClick={() => run('cancel', 'cancel_listing_response', 'cancelled')}
          disabled={loading !== null}
          className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading === 'cancel' ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
          Annuler ma demande
        </button>
      )}
    </div>
  )
}
