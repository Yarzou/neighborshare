'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Plus, Loader2 } from 'lucide-react'
import type { ConversationWithDetails } from '@/lib/types'
import { fetchConversationsOverview, createDebouncedRefresh } from '@/lib/messaging'
import { ConversationRow } from '@/components/messages/ConversationRow'

/** `userId` est résolu côté serveur par `page.tsx` (voir son commentaire). */
export default function MessagesClient({ userId }: { userId: string }) {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([])

  /**
   * Une seule requête là où il y en avait quatre en séquence — dont un `select`
   * sur `messages` NON BORNÉ, qui ramenait tout l'historique de l'utilisateur
   * pour n'en extraire que le dernier message de chaque fil. Le regroupement se
   * fait maintenant en base (`conversations_overview`, migration 039), avec
   * repli automatique sur l'ancien chemin tant qu'elle n'est pas appliquée.
   */
  const refresh = useCallback(async () => {
    setConversations(await fetchConversationsOverview(supabase, userId))
  }, [supabase, userId])

  useEffect(() => {
    void refresh().finally(() => setLoading(false))
  }, [refresh])

  // Realtime : met à jour la liste à chaque nouveau message
  useEffect(() => {
    // Un rafraîchissement par message était intenable quand il coûtait quatre
    // requêtes ; il en coûte une désormais, mais une rafale (conversation de
    // groupe active) mérite toujours d'être regroupée.
    const refresher = createDebouncedRefresh(refresh, 400)

    const channel = supabase
      .channel('messages_list_updates')
      // Volontairement SANS filtre `conversation_id` : le Realtime applique le
      // RLS de `messages`, on ne reçoit donc que les fils dont on est
      // participant. Un filtre `in.(…)` devrait être reconstruit à chaque
      // nouvelle conversation — et manquerait justement le cas « quelqu'un
      // m'écrit pour la première fois ».
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => refresher.schedule())
      // La vue d'ensemble porte aussi les non-lus : une conversation lue depuis
      // un autre onglet (`mark_conversation_read` → `last_read_at`) doit faire
      // retomber la pastille ici aussi.
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
        () => refresher.schedule())
      .subscribe()

    return () => {
      refresher.cancel()
      supabase.removeChannel(channel)
    }
  }, [supabase, userId, refresh])

  const handleDeleteConversation = async (convId: string) => {
    // Soft delete : masque la conversation + mémorise la coupure d'historique
    const now = new Date().toISOString()
    setConversations(prev => prev.filter(c => c.id !== convId))
    const { error } = await supabase
      .from('conversation_participants')
      .update({ deleted_at: now, visible_from: now })
      .eq('conversation_id', convId)
      .eq('user_id', userId)
    if (error) {
      await refresh()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-brand-600" size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="text-brand-600" size={26} />
          Messages
        </h1>
        <Link
          href="/messages/new"
          className="flex items-center justify-center gap-1.5
                     w-10 h-10 rounded-full
                     sm:w-auto sm:h-auto sm:px-4 sm:py-2 sm:rounded-xl
                     bg-brand-600 text-white hover:bg-brand-700 transition-colors
                     text-sm font-medium flex-shrink-0"
          aria-label="Nouvelle conversation"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Nouvelle conversation</span>
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
          <MessageCircle size={48} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Aucune conversation pour l&apos;instant</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map(conv => (
            <ConversationRow
              key={conv.id}
              conv={conv}
              userId={userId}
              onDelete={handleDeleteConversation}
            />
          ))}
        </div>
      )}
    </div>
  )
}
